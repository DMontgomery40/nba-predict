from __future__ import annotations

import json
from dataclasses import dataclass
from urllib.request import Request, urlopen

from nba_api.live.nba.endpoints import boxscore, playbyplay, scoreboard
from nba_api.stats.endpoints import scoreboardv2

from .models import BoxScoreResponse, PlayByPlayResponse, ScoreboardResponse
from .normalizers import (
    is_today,
    normalize_live_boxscore_payload,
    normalize_live_playbyplay_payload,
    normalize_live_scoreboard_payload,
    normalize_schedule_league_payload,
    normalize_stats_scoreboard_payload,
)

NBA_SCHEDULE_CDN_URL = "https://cdn.nba.com/static/json/staticData/scheduleLeagueV2_1.json"
NBA_LIVE_SCOREBOARD_CDN_URL = (
    "https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json"
)
NBA_CDN_HEADERS = {
    "Referer": "https://www.nba.com/",
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    ),
}


@dataclass(slots=True)
class NbaSidecarService:
    def get_scoreboard(self, requested_date: str | None = None) -> ScoreboardResponse:
        if requested_date and not is_today(requested_date):
            try:
                payload = scoreboardv2.ScoreboardV2(
                    game_date=requested_date,
                    day_offset=0,
                    league_id="00",
                ).get_dict()
                normalized = normalize_stats_scoreboard_payload(
                    payload, requested_date=requested_date
                )
                if normalized.games:
                    return normalized
            except Exception:
                pass

            return self.get_schedule_scoreboard(requested_date)

        try:
            payload = scoreboard.ScoreBoard().get_dict()
        except Exception:
            payload = self.get_live_scoreboard_payload()
        return normalize_live_scoreboard_payload(payload, requested_date=requested_date)

    def get_live_scoreboard_payload(self) -> dict:
        request = Request(NBA_LIVE_SCOREBOARD_CDN_URL, headers=NBA_CDN_HEADERS)
        with urlopen(request, timeout=30) as response:
            payload = response.read()

        return json.loads(payload)

    def get_schedule_scoreboard(self, requested_date: str) -> ScoreboardResponse:
        request = Request(NBA_SCHEDULE_CDN_URL, headers=NBA_CDN_HEADERS)
        with urlopen(request, timeout=30) as response:
            payload = response.read()

        return normalize_schedule_league_payload(
            json.loads(payload), requested_date=requested_date
        )

    def get_game(self, game_id: str) -> BoxScoreResponse:
        payload = boxscore.BoxScore(game_id=game_id).get_dict()
        return normalize_live_boxscore_payload(game_id=game_id, payload=payload)

    def get_play_by_play(self, game_id: str) -> PlayByPlayResponse:
        payload = playbyplay.PlayByPlay(game_id=game_id).get_dict()
        return normalize_live_playbyplay_payload(game_id=game_id, payload=payload)
