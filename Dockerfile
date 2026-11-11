FROM golang:1.27-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/tbh ./cmd/tbh \
    && mkdir -p /out/data

# Static, non-root image with CA certificates (needed for SMTP and imports).
FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/tbh /usr/local/bin/tbh
COPY --from=build --chown=nonroot:nonroot /out/data /data
ENV DATABASE_PATH=/data/tbh.db \
    ADDR=:3000
VOLUME /data
EXPOSE 3000
ENTRYPOINT ["tbh"]
CMD ["serve"]
