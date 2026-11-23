extends Node

## GAMA LocalizationSystem Autoload for Godot 4 AI Agents.
## Provides instant Arabic (RTL) and English dictionary localization,
## live language switching (`set_locale("ar")` / `set_locale("en")`),
## and persistent locale storage via GameState.

signal locale_changed(new_locale: String)

var current_locale: String = "ar"

var _catalog: Dictionary = {
	"START_GAME": {"ar": "ابدأ اللعب", "en": "START GAME"},
	"QUIT_GAME": {"ar": "خروج", "en": "QUIT"},
	"PLAY_AGAIN": {"ar": "العب مجددًا", "en": "PLAY AGAIN"},
	"MAIN_MENU": {"ar": "القائمة الرئيسية", "en": "MAIN MENU"},
	"GAME_OVER": {"ar": "انتهت اللعبة", "en": "GAME OVER"},
	"PAUSED": {"ar": "متوقف مؤقتًا", "en": "PAUSED"},
	"SCORE": {"ar": "النقاط", "en": "SCORE"},
	"HIGH_SCORE": {"ar": "أعلى نتيجة", "en": "HIGH SCORE"},
	"HEALTH": {"ar": "الصحة", "en": "HP"},
	"QUEST_NEW": {"ar": "مهمة جديدة", "en": "QUEST NEW"},
	"QUEST_COMPLETE": {"ar": "اكتملت المهمة", "en": "QUEST COMPLETE"}
}


func _ready() -> void:
	var saved_loc: Variant = GameState.get_value("locale", "ar")
	if saved_loc is String and (saved_loc == "ar" or saved_loc == "en"):
		current_locale = saved_loc as String


func set_locale(locale_code: String) -> void:
	var clean: String = "ar" if locale_code.to_lower().begins_with("ar") else "en"
	current_locale = clean
	GameState.set_value("locale", clean)
	locale_changed.emit(clean)


func translate(key: String, fallback: String = "") -> String:
	if _catalog.has(key):
		var entry: Dictionary = _catalog[key] as Dictionary
		if entry.has(current_locale):
			return str(entry[current_locale])
	return fallback if fallback != "" else key


func register_translation(key: String, ar_text: String, en_text: String) -> void:
	_catalog[key] = {"ar": ar_text, "en": en_text}


func is_rtl() -> bool:
	return current_locale == "ar"
