extends CanvasLayer

## GAMA Mobile Touch Controls Overlay (Virtual Joystick Buttons + Jump/Action)
## Enables instant Android touch gameplay for any 2D or 3D GAMA Godot 4 game
## by emitting standard `Input.action_press()` / `action_release()` events.

@onready var _btn_left: Button = $LeftPad/BtnLeft
@onready var _btn_right: Button = $LeftPad/BtnRight
@onready var _btn_jump: Button = $RightPad/BtnJump
@onready var _btn_action: Button = $RightPad/BtnAction


func _ready() -> void:
	layer = 25
	if _btn_left != null:
		_btn_left.button_down.connect(_press_left)
		_btn_left.button_up.connect(_release_left)
	if _btn_right != null:
		_btn_right.button_down.connect(_press_right)
		_btn_right.button_up.connect(_release_right)
	if _btn_jump != null:
		_btn_jump.button_down.connect(_press_jump)
		_btn_jump.button_up.connect(_release_jump)
	if _btn_action != null:
		_btn_action.button_down.connect(_press_action)
		_btn_action.button_up.connect(_release_action)


func _press_left() -> void:
	Input.action_press("move_left")


func _release_left() -> void:
	Input.action_release("move_left")


func _press_right() -> void:
	Input.action_press("move_right")


func _release_right() -> void:
	Input.action_release("move_right")


func _press_jump() -> void:
	Input.action_press("jump")


func _release_jump() -> void:
	Input.action_release("jump")


func _press_action() -> void:
	Input.action_press("action")


func _release_action() -> void:
	Input.action_release("action")
