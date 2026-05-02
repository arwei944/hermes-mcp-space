"""
审核队列 API 路由
"""
from fastapi import APIRouter, Query
from pydantic import BaseModel
from typing import Optional, List

router = APIRouter(prefix="/api/reviews", tags=["reviews"])


class ModifyApproveRequest(BaseModel):
    modified_content: str
    review_note: str = ""


class BatchActionRequest(BaseModel):
    ids: List[str]


@router.get("")
async def list_reviews(
    status: str = Query(None), target_type: str = Query(None),
    limit: int = Query(50, le=200), offset: int = Query(0)
):
    from backend.services.review_service import ReviewService
    svc = ReviewService()
    return {"success": True, "data": svc.list_reviews(
        status=status, target_type=target_type, limit=limit, offset=offset
    )}


@router.get("/stats")
async def review_stats():
    from backend.services.review_service import ReviewService
    svc = ReviewService()
    return {"success": True, "data": svc.get_review_stats()}


@router.get("/{review_id}")
async def get_review(review_id: str):
    from backend.services.review_service import ReviewService
    svc = ReviewService()
    item = svc.get_review(review_id)
    if not item:
        return {"success": False, "error": f"审核 {review_id} 不存在"}
    return {"success": True, "data": item}


@router.put("/{review_id}/approve")
async def approve_review(review_id: str, review_note: str = ""):
    from backend.services.review_service import ReviewService
    svc = ReviewService()
    result = svc.approve_review(review_id, reviewed_by="admin", review_note=review_note)
    if not result:
        return {"success": False, "error": "审核失败"}
    return {"success": True, "data": result}


@router.put("/{review_id}/reject")
async def reject_review(review_id: str, review_note: str = ""):
    from backend.services.review_service import ReviewService
    svc = ReviewService()
    result = svc.reject_review(review_id, reviewed_by="admin", review_note=review_note)
    if not result:
        return {"success": False, "error": "拒绝失败"}
    return {"success": True, "data": result}


@router.put("/{review_id}/modify")
async def modify_and_approve(review_id: str, req: ModifyApproveRequest):
    from backend.services.review_service import ReviewService
    svc = ReviewService()
    result = svc.modify_and_approve(review_id, req.modified_content, "admin", req.review_note)
    if not result:
        return {"success": False, "error": "修改后通过失败"}
    return {"success": True, "data": result}


@router.post("/batch/approve")
async def batch_approve(req: BatchActionRequest):
    from backend.services.review_service import ReviewService
    svc = ReviewService()
    return {"success": True, "data": svc.batch_approve(req.ids, "admin")}


@router.post("/batch/reject")
async def batch_reject(req: BatchActionRequest):
    from backend.services.review_service import ReviewService
    svc = ReviewService()
    return {"success": True, "data": svc.batch_reject(req.ids, "admin")}


@router.post("/cleanup")
async def cleanup_expired_reviews():
    """清理过期的审核记录（7天未处理）"""
    from backend.services.review_service import ReviewService
    svc = ReviewService()
    svc.expire_old_reviews()
    return {"success": True, "message": "过期审核已清理"}
