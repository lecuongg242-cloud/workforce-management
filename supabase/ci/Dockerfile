# supabase/ci/Dockerfile
#
# Postgres 17 + pgTAP dung rieng cho GitHub Actions (D-04). Anh postgres
# chinh thuc da cau hinh san kho PGDG nen goi pgtap theo dung phien ban co
# san. Xay anh ngay trong workflow thay vi dung `services:` voi mot anh
# Postgres ben thu ba dung san — nho vay khong phai doan tag cua anh nao co
# san pgTAP.

FROM postgres:17

RUN apt-get update \
    && apt-get install -y --no-install-recommends postgresql-17-pgtap \
    && rm -rf /var/lib/apt/lists/*
