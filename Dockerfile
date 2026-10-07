FROM gotenberg/gotenberg:8-libreoffice

CMD ["gotenberg", "--api-enable-basic-auth=true", "--api-timeout=120s", "--api-body-limit=50MB"]
