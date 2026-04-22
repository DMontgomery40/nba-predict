from nba_sidecar.normalizers import (
    normalize_live_boxscore_payload,
    normalize_live_playbyplay_payload,
    normalize_live_scoreboard_payload,
    normalize_stats_scoreboard_payload,
)


def test_normalize_live_scoreboard_payload_maps_game_and_state() -> None:
    payload = {
        "meta": {"time": "2026-04-22T05:55:00.000Z"},
        "scoreboard": {
            "gameDate": "2026-04-22",
            "games": [
                {
                    "awayTeam": {
                        "score": 108,
                        "teamCity": "New York",
                        "teamName": "Knicks",
                        "teamTricode": "NYK",
                    },
                    "gameClock": "00:42",
                    "gameId": "0022600001",
                    "gameStatus": 2,
                    "homeTeam": {
                        "score": 112,
                        "teamCity": "Boston",
                        "teamName": "Celtics",
                        "teamTricode": "BOS",
                    },
                    "period": 4,
                }
            ],
        },
    }

    normalized = normalize_live_scoreboard_payload(payload)

    assert normalized.requestedDate == "2026-04-22"
    assert normalized.games[0].game.id == "nba-0022600001"
    assert normalized.games[0].game.homeParticipant.abbreviation == "BOS"
    assert normalized.games[0].gameState.status == "in-play"
    assert normalized.games[0].gameState.homeScore == 112


def test_normalize_live_boxscore_payload_derives_final_outcome() -> None:
    payload = {
        "meta": {"time": "2026-04-22T06:12:00.000Z"},
        "game": {
            "awayTeam": {
                "score": 110,
                "teamCity": "New York",
                "teamName": "Knicks",
                "teamTricode": "NYK",
            },
            "gameEt": "2026-04-22T02:00:00Z",
            "gameStatus": 3,
            "homeTeam": {
                "score": 118,
                "teamCity": "Boston",
                "teamName": "Celtics",
                "teamTricode": "BOS",
            },
            "period": 4,
        },
    }

    normalized = normalize_live_boxscore_payload("0022600001", payload)

    assert normalized.game.gameState.isFinal is True
    assert normalized.game.outcome is not None
    assert normalized.game.outcome.winnerKey == "bos"


def test_normalize_live_playbyplay_payload_keeps_core_action_fields() -> None:
    payload = {
        "meta": {"time": "2026-04-22T05:55:15.000Z"},
        "game": {
            "actions": [
                {
                    "actionNumber": 1,
                    "actionType": "jumpball",
                    "clock": "PT12M00.00S",
                    "description": "Opening tip",
                    "period": 1,
                    "scoreAway": "0",
                    "scoreHome": "0",
                    "teamTricode": "BOS",
                    "timeActual": "2026-04-22T02:01:00Z",
                }
            ]
        },
    }

    normalized = normalize_live_playbyplay_payload("0022600001", payload)

    assert normalized.gameId == "0022600001"
    assert normalized.actions[0].actionType == "jumpball"
    assert normalized.actions[0].teamTricode == "BOS"


def test_normalize_stats_scoreboard_payload_dedupes_repeated_game_headers() -> None:
    payload = {
        "resultSets": [
            {
                "headers": [
                    "GAME_ID",
                    "GAME_STATUS_ID",
                    "GAME_STATUS_TEXT",
                    "GAME_DATE_EST",
                    "HOME_TEAM_ID",
                    "VISITOR_TEAM_ID",
                    "LIVE_PERIOD",
                    "LIVE_PC_TIME",
                ],
                "name": "GameHeader",
                "rowSet": [
                    [
                        "0042500112",
                        1,
                        "7:00 pm ET",
                        "2026-04-24T00:00:00",
                        "1610612755",
                        "1610612738",
                        0,
                        "",
                    ],
                    [
                        "0042500112",
                        1,
                        "7:00 pm ET",
                        "2026-04-24T00:00:00",
                        "1610612755",
                        "1610612738",
                        0,
                        "",
                    ],
                ],
            },
            {
                "headers": [
                    "GAME_ID",
                    "TEAM_ID",
                    "TEAM_CITY_NAME",
                    "TEAM_NAME",
                    "TEAM_ABBREVIATION",
                    "PTS",
                ],
                "name": "LineScore",
                "rowSet": [
                    ["0042500112", "1610612755", "Philadelphia", "76ers", "PHI", ""],
                    ["0042500112", "1610612738", "Boston", "Celtics", "BOS", ""],
                ],
            },
        ]
    }

    normalized = normalize_stats_scoreboard_payload(payload, requested_date="2026-04-24")

    assert len(normalized.games) == 1
    assert normalized.games[0].game.id == "nba-0042500112"
