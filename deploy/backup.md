# Backup Strategy — Yu-Gi-Oh Edison on Fly.io

## Automatic: Fly.io Daily Volume Snapshots

Fly.io automatically takes daily snapshots of persistent volumes. No configuration needed.

To list snapshots:

```bash
fly volumes list -a <your-app-name>
# Get the volume ID from the output, then:
fly volumes snapshots list <volume-id>
```

To restore from a snapshot:

```bash
# Create a new volume from the snapshot
fly volumes create yugioh_data \
  --snapshot-id <snapshot-id> \
  --size 3 \
  --region ord \
  -a <your-app-name>
```

Fly retains snapshots for 5 days by default. For longer retention, use the manual dump below.

## Manual: SQLite Dump via SSH

Run from your workstation whenever you want an on-demand backup:

```bash
# 1. Open a console inside the running Machine
fly ssh console -a <your-app-name>

# 2. Inside the console — dump the SQLite DB to a file on the volume
sqlite3 /data/yugioh.db ".backup /data/yugioh-backup-$(date +%Y%m%d).db"
# or as a plain SQL dump:
sqlite3 /data/yugioh.db .dump > /data/yugioh-dump-$(date +%Y%m%d).sql

exit
```

```bash
# 3. Copy the backup off the Machine to your local workstation
fly sftp get /data/yugioh-backup-YYYYMMDD.db ./backups/ -a <your-app-name>
# or use fly ssh for scp-style copy
```

## What Lives on the Volume

| Path              | Contents                                 | Backup method                               |
| ----------------- | ---------------------------------------- | ------------------------------------------- |
| `/data/yugioh.db` | SQLite database (users, decks, sessions) | Daily snapshot + manual dump                |
| `/data/images/`   | Self-hosted card images (~500 MB)        | Daily snapshot; re-seedable from YGOPRODeck |

Images are re-seedable at any time by running `deploy/seed-images.mjs` (idempotent). Prioritize backing up the SQLite DB for user data.

## Recovery Priority

1. **SQLite DB** — contains all user accounts, decks, invite codes, sessions. Essential.
2. **Images** — large but fully recoverable from YGOPRODeck at no cost. Not essential to back up separately.
