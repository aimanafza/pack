from beanie import Document, PydanticObjectId
from pymongo import IndexModel


class UploadUsage(Document):
    """How much of this month's upload allowance a user has used. One document per
    user per calendar month (UTC), so the count starts fresh on the 1st."""

    user_id: PydanticObjectId
    month: str                 # "2026-10"
    items_added: int = 0       # new wardrobe items saved; deleting an item never gives one back
    photos_read: int = 0       # photos Claude read to autofill, saved or not

    class Settings:
        name = "upload_usage"
        indexes = [IndexModel([("user_id", 1), ("month", 1)], unique=True)]
