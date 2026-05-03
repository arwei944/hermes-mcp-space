"""
Ops Client — Ops Protocol v1.0 协议兼容客户端
零依赖，只需 Python 3.7+ 标准库。
"""
import os, sys, json, time, socket, platform, threading, logging, urllib.request, urllib.error
from datetime import datetime
logger = logging.getLogger("ops-agent")

class OpsClient:
    def __init__(self, server, project_id, project_name, project_url="", project_type="", version="", environment="", heartbeat_interval=60, timeout=10):
        self.server = server.rstrip("/")
        self.project_id = project_id
        self.project_name = project_name
        self.project_url = project_url
        self.project_type = project_type
        self.version = version
        self.environment = environment
        self.heartbeat_interval = heartbeat_interval
        self.timeout = timeout
        self._started_at = datetime.now().isoformat()
        self._process_start_time = 0
        self._thread = None
        self._running = False
        self._business_collectors = []
        self._total_requests = 0
        self._error_count = 0
        self._active_connections = 0
        self._queue_depth = 0

    def _collect_system(self):
        data = {"cpu_percent":0.0,"memory_mb":0.0,"memory_percent":0.0,"disk_mb":0.0,"disk_percent":0.0,"load_avg":[],"open_files":0,"threads":0,"uptime_seconds":int(time.time()-self._process_start_time)}
        try: data["cpu_percent"]=self._cpu_percent()
        except: pass
        try:
            with open("/proc/self/status","r") as f:
                for line in f:
                    if line.startswith("VmRSS:"): data["memory_mb"]=round(int(line.split()[1])/1024,1)
                    elif line.startswith("Threads:"): data["threads"]=int(line.split()[1])
            with open("/proc/meminfo","r") as f:
                mi={}
                for line in f:
                    p=line.split()
                    if len(p)>=2: mi[p[0].rstrip(":")]=int(p[1])
                t=mi.get("MemTotal",1); a=mi.get("MemAvailable",mi.get("MemFree",0))
                data["memory_percent"]=round((1-a/t)*100,1) if t>0 else 0.0
        except: pass
        try:
            st=os.statvfs("/"); t=st.f_blocks*st.f_frsize/(1024*1024); fr=st.f_bavail*st.f_frsize/(1024*1024)
            data["disk_mb"]=round(t-fr,1); data["disk_percent"]=round((1-fr/t)*100,1) if t>0 else 0.0
        except: pass
        try:
            with open("/proc/loadavg","r") as f: data["load_avg"]=[float(x) for x in f.readline().split()[:3]]
        except: pass
        try: data["open_files"]=len(os.listdir("/proc/self/fd"))
        except: pass
        return data

    def _cpu_percent(self):
        try:
            with open("/proc/stat","r") as f: v=list(map(int,f.readline().split()[1:8]))
            time.sleep(0.1)
            with open("/proc/stat","r") as f: v2=list(map(int,f.readline().split()[1:8]))
            di=v2[3]-v[3]; dt=sum(b-a for a,b in zip(v,v2))
            return round((1-di/dt)*100,1) if dt>0 else 0.0
        except: return 0.0

    def _collect_runtime(self):
        return {"total_requests":self._total_requests,"active_connections":self._active_connections,"error_count_last_hour":self._error_count,"avg_response_ms":0.0,"queue_depth":self._queue_depth}

    def _collect_business(self):
        b={}
        for c in self._business_collectors:
            try:
                r=c()
                if isinstance(r,dict): b.update(r)
            except: pass
        return b

    def _post(self, path, data):
        url=f"{self.server}{path}"
        payload=json.dumps(data,ensure_ascii=False).encode("utf-8")
        req=urllib.request.Request(url,data=payload,method="POST",headers={"Content-Type":"application/json"})
        try:
            with urllib.request.urlopen(req,timeout=self.timeout) as resp: return resp.status<400
        except: return False

    def start(self):
        self._process_start_time=time.time(); self._running=True
        self._post("/api/ops/register",{"protocol":"ops-v1","project_id":self.project_id,"project_name":self.project_name,"project_url":self.project_url,"project_type":self.project_type,"version":self.version,"environment":self.environment,"hostname":socket.gethostname(),"ip":self._get_local_ip(),"platform":{"os":platform.system(),"python":platform.python_version(),"framework":"Gradio+FastAPI","sdk":"docker"},"started_at":self._started_at})
        logger.info(f"OpsClient registered: {self.project_name}")
        self._thread=threading.Thread(target=self._heartbeat_loop,daemon=True); self._thread.start()

    def stop(self): self._running=False

    def snapshot(self, config=None, dependencies=None, endpoints=None, features=None, metadata=None):
        self._post("/api/ops/snapshot",{"project_id":self.project_id,"config":config or {},"dependencies":dependencies or [],"endpoints":endpoints or [],"features":features or [],"metadata":metadata or {}})

    def add_business_collector(self, func): self._business_collectors.append(func)

    def emit_event(self, event_type, level="info", message="", data=None):
        self._post("/api/ops/event",{"project_id":self.project_id,"event_type":event_type,"level":level,"message":message,"data":data or {},"timestamp":datetime.now().isoformat()})

    def emit_log(self, level, message, logger_name="", traceback=""):
        self._post("/api/ops/log",{"project_id":self.project_id,"level":level,"logger":logger_name,"message":message,"traceback":traceback,"timestamp":datetime.now().isoformat()})

    def set_runtime_metrics(self, total_requests=None, active_connections=None, error_count=None, avg_response_ms=None, queue_depth=None):
        if total_requests is not None: self._total_requests=total_requests
        if active_connections is not None: self._active_connections=active_connections
        if error_count is not None: self._error_count=error_count
        if queue_depth is not None: self._queue_depth=queue_depth

    def _heartbeat_loop(self):
        while self._running:
            try:
                self._post("/api/ops/heartbeat",{"project_id":self.project_id,"system":self._collect_system(),"runtime":self._collect_runtime(),"business":self._collect_business()})
            except: pass
            for _ in range(self.heartbeat_interval):
                if not self._running: break
                time.sleep(1)

    @staticmethod
    def _get_local_ip():
        try:
            s=socket.socket(socket.AF_INET,socket.SOCK_DGRAM); s.connect(("8.8.8.8",80)); ip=s.getsockname()[0]; s.close(); return ip
        except: return "127.0.0.1"

OpsAgent = OpsClient
