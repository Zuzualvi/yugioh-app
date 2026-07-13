import BetterSQLite from 'better-sqlite3';

const CDB_PATH = '/workspace/yugioh-app/spikes/spike-a-ruleset/vendor/cdb/cards.cdb';

let _db = null;
let _stmt = null;

export function openDb() {
  if (_db) return;
  _db = new BetterSQLite(CDB_PATH);
  _stmt = _db.prepare(
    `SELECT datas.id, datas.alias, datas.setcode, datas.type,
            datas.atk, datas.def, datas.level, datas.race,
            datas.attribute, datas.ot, datas.category
     FROM datas WHERE datas.id = ?`
  );
}

export function getCard(code) {
  if (!_db) openDb();
  const row = _stmt.get(code);
  if (!row) return null;
  return {
    code:       row.id,
    alias:      row.alias || 0,
    setcodes:   row.setcode ? [row.setcode] : [],
    type:       row.type,
    attack:     row.atk,
    defense:    row.def,
    level:      row.level & 0xFF,
    lscale:     (row.level >> 24) & 0xFF,
    rscale:     (row.level >> 16) & 0xFF,
    race:       BigInt(row.race),
    attribute:  row.attribute,
    linkMarker: 0,
    ot:         row.ot,
    category:   row.category || 0,
  };
}
