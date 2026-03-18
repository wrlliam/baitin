railpack build . --start-cmd="bun run dev" --build-cmd="sleep 1"
sleep 1
docker compose down
sleep 1
docker compose up -d
sleep 1
docker exec baitin bun run db:push