from apscheduler.schedulers.background import BackgroundScheduler
from django_apscheduler.jobstores import DjangoJobStore
from django.utils import timezone

def delete_expired_recordings():
    from .models import Recording
    expired = Recording.objects.filter(
        expires_at__isnull=False,
        expires_at__lt=timezone.now()
    )
    count = expired.count()
    expired.delete()
    print(f"[ObliVox] Deleted {count} expired recording(s).")

def start():
    scheduler = BackgroundScheduler()
    scheduler.add_jobstore(DjangoJobStore(), "default")
    scheduler.add_job(
        delete_expired_recordings,
        "interval",
        minutes=5,
        id="delete_expired_recordings",
        replace_existing=True,
    )
    scheduler.start()
    print("[ObliVox] Scheduler started.")