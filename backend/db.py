import os
import uuid
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]


def new_id() -> str:
    return uuid.uuid4().hex


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


NO_ID = {"_id": 0}


async def ensure_indexes():
    await db.users.create_index("email", unique=True)
    await db.employees.create_index([("company_id", 1)])
    await db.attendance.create_index([("company_id", 1), ("date", 1)])
    await db.attendance.create_index([("employee_id", 1), ("date", 1)])
    await db.leave_requests.create_index([("company_id", 1)])
    await db.payslips.create_index([("company_id", 1), ("month", 1)])
