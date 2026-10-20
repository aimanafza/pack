# What each PACK plan allows. Paid plans get their own entry here when they exist;
# everything that enforces a limit reads it from this table.
PLAN_LIMITS = {
    "free": {
        # Each new item costs a Cloudinary background removal (~76 transformations)
        "items_per_month": 100,
        # Photos Claude reads to autofill, including ones never saved; twice the item limit
        "photo_reads_per_month": 200,
        "photos_per_batch": 30,
    },
}


def limits_for(user) -> dict:
    return PLAN_LIMITS.get(getattr(user, "plan", "free"), PLAN_LIMITS["free"])
