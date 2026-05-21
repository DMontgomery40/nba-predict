SELECT smid, source, iid, family, displayLabel, participantKey, line, selection,
           rawFamily, rawLabel, gameId, checkpoint, p, ageSec FROM (
      SELECT sm.id smid, sm.source source, sm.instrument_id iid, mi.family family,
             mi.display_label displayLabel, mi.participant_key participantKey,
             mi.line line, mi.selection selection, sm.raw_family rawFamily,
             sm.raw_label rawLabel, sm.game_id gameId, a.checkpoint checkpoint,
             q.implied_probability p,
             (julianday(a.ts) - julianday(q.captured_at)) * 86400.0 ageSec,
             ROW_NUMBER() OVER (PARTITION BY sm.instrument_id, sm.source, a.checkpoint ORDER BY q.captured_at DESC) rnInstr
      FROM source_markets sm
      JOIN market_instruments mi ON mi.id = sm.instrument_id
      JOIN tmp_anchor a ON a.game_id = sm.game_id
      JOIN quote_ticks q ON q.source_market_id = sm.id
        AND q.captured_at <= a.ts AND q.implied_probability IS NOT NULL
      WHERE mi.family IN ('moneyline','spread','total') 
    ) WHERE rnInstr = 1
