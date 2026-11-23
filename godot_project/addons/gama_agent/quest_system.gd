extends Node

## GAMA QuestSystem Autoload for Godot 4 AI Agents.
## Manages active quests, objective progress counters, completion rewards,
## DialogueSystem announcements, and persistent save synchronization via GameState.

signal quest_started(quest_id: String, title: String, target_count: int)
signal quest_progressed(quest_id: String, current_count: int, target_count: int)
signal quest_completed(quest_id: String, reward_score: int)

var _quests: Dictionary = {}


func start_quest(
	quest_id: String,
	title: String,
	target_count: int = 3,
	reward_score: int = 150
) -> void:
	if quest_id == "":
		return
	var goal: int = maxi(1, target_count)
	_quests[quest_id] = {
		"title": title,
		"current": 0,
		"target": goal,
		"reward": maxi(0, reward_score),
		"completed": false
	}
	GameState.set_value("quest_" + quest_id, _quests[quest_id])
	DialogueSystem.show_line("QUEST NEW", title + " (0/" + str(goal) + ")", 2.4)
	quest_started.emit(quest_id, title, goal)


func advance_quest(quest_id: String, step: int = 1) -> bool:
	if not _quests.has(quest_id):
		return false
	var q: Dictionary = _quests[quest_id] as Dictionary
	if bool(q.get("completed", false)):
		return false

	var cur: int = int(q.get("current", 0)) + maxi(1, step)
	var target: int = int(q.get("target", 1))
	q["current"] = mini(cur, target)
	quest_progressed.emit(quest_id, int(q["current"]), target)

	if int(q["current"]) >= target:
		q["completed"] = true
		var reward: int = int(q.get("reward", 100))
		GameState.add_score(reward)
		GameState.set_value("quest_" + quest_id, q)
		GameState.save_game()
		Juice.reward()
		AudioSynth.play_tone(1240.0, 0.15, 0.26)
		DialogueSystem.show_line("QUEST COMPLETE", str(q.get("title", quest_id)) + " (+" + str(reward) + " PTS)", 2.8)
		quest_completed.emit(quest_id, reward)
		return true

	GameState.set_value("quest_" + quest_id, q)
	return false


func is_completed(quest_id: String) -> bool:
	if not _quests.has(quest_id):
		return false
	var q: Dictionary = _quests[quest_id] as Dictionary
	return bool(q.get("completed", false))


func get_quest_status(quest_id: String) -> Dictionary:
	if not _quests.has(quest_id):
		return {}
	return _quests[quest_id] as Dictionary
