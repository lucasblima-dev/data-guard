import math
from uuid import UUID

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.job import AnalysisJobModel
from app.schemas.job import JobCreate, JobListResponse, JobResponse, JobStatus, JobUpdate


class JobService:
    @staticmethod
    async def create_job(db: AsyncSession, data: JobCreate) -> AnalysisJobModel:
        job = AnalysisJobModel(
            original_filename=data.original_filename,
            file_size_bytes=data.file_size_bytes,
            file_ref=data.file_ref,
            status=JobStatus.ENVIADA.value,
        )
        db.add(job)
        await db.commit()
        await db.refresh(job)
        return job

    @staticmethod
    async def get_job_by_id(db: AsyncSession, job_id: UUID) -> AnalysisJobModel | None:
        statement = select(AnalysisJobModel).where(AnalysisJobModel.id == job_id)
        result = await db.execute(statement)
        return result.scalar_one_or_none()

    @staticmethod
    async def list_jobs(
        db: AsyncSession,
        page: int = 1,
        page_size: int = 10,
        status: JobStatus | None = None,
    ) -> JobListResponse:
        offset = (page - 1) * page_size

        count_query = select(func.count(AnalysisJobModel.id))
        if status:
            count_query = count_query.where(AnalysisJobModel.status == status.value)
        total_result = await db.execute(count_query)
        total = total_result.scalar_one()

        items_query = select(AnalysisJobModel).order_by(desc(AnalysisJobModel.created_at))
        if status:
            items_query = items_query.where(AnalysisJobModel.status == status.value)
        items_query = items_query.offset(offset).limit(page_size)

        items_result = await db.execute(items_query)
        jobs = items_result.scalars().all()

        total_pages = math.ceil(total / page_size) if total > 0 else 0

        return JobListResponse(
            items=[JobResponse.model_validate(job) for job in jobs],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )

    @staticmethod
    async def update_job(
        db: AsyncSession,
        job: AnalysisJobModel,
        data: JobUpdate,
    ) -> AnalysisJobModel:
        update_data = data.model_dump(exclude_unset=True)

        for key, value in update_data.items():
            if key == "status" and isinstance(value, JobStatus):
                setattr(job, key, value.value)
            else:
                setattr(job, key, value)

        await db.commit()
        await db.refresh(job)
        return job

    @staticmethod
    async def delete_job(db: AsyncSession, job: AnalysisJobModel) -> None:
        await db.delete(job)
        await db.commit()
