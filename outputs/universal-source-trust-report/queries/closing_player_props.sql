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
      WHERE mi.family = 'player-prop' AND sm.game_id IN ('nba-0042500102','nba-0042500103','nba-0042500104','nba-0042500105','nba-0042500106','nba-0042500107','nba-0042500112','nba-0042500113','nba-0042500114','nba-0042500115','nba-0042500116','nba-0042500117','nba-0042500122','nba-0042500123','nba-0042500124','nba-0042500125','nba-0042500126','nba-0042500132','nba-0042500133','nba-0042500134','nba-0042500135','nba-0042500136','nba-0042500137','nba-0042500142','nba-0042500143','nba-0042500144','nba-0042500152','nba-0042500153','nba-0042500154','nba-0042500155','nba-0042500162','nba-0042500163','nba-0042500164','nba-0042500165','nba-0042500166','nba-0042500172','nba-0042500173','nba-0042500174','nba-0042500175','nba-0042500176','nba-0042500201','nba-0042500202','nba-0042500203','nba-0042500204','nba-0042500205','nba-0042500206','nba-0042500207','nba-0042500211','nba-0042500212','nba-0042500213','nba-0042500214','nba-0042500221','nba-0042500222','nba-0042500223','nba-0042500224','nba-0042500231','nba-0042500232','nba-0042500233','nba-0042500234','nba-0042500235','nba-0042500236','nba-0042500301','nba-0042500311','nba-0042500312')
    ) WHERE rnInstr = 1
