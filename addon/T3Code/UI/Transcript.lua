-- Right side of the window: the selected thread's conversation, what the agent is
-- doing right now, and anything it is waiting on you for.

local _, ns = ...
local UI = ns.UI

local T = {}
ns.Transcript = T

T.echo = {}      -- threadId -> { text, at, after } sent but not yet in a snapshot
T.answers = {}   -- requestId -> { [questionId] = { value = true, ... } }

local QUICK_REPLIES = {
	"Carry on.",
	"Looks good, thanks.",
	"Explain that more simply.",
	"Try a different approach.",
}

---------------------------------------------------------------------------
-- How rows are drawn

-- A message is a header row ("agent", the time) and one row per block of its text:
-- paragraph, heading, list item, code, quote, rule, table row. Small rows are what
-- lets each kind have its own font and spacing, and what keeps scrolling even.
--
-- STYLE says how each kind of text looks and LAYOUT holds the distances. They are
-- data, not code, because tools/preview reads them to draw the same rows outside
-- the game.
local SIZES = { small = 12, medium = 13, large = 14, xlarge = 16 }

-- A font string has one weight, so the bridge colours bold gold. Body text sits a
-- little under white, and headings and table headers are white and larger: structure
-- reads by size and brightness, emphasis by colour.
local BODY, WHITE, GOLD = { 0.8, 0.8, 0.78 }, { 1, 1, 1 }, { 1, 0.82, 0 }
-- Code is drawn in a fixed-width font so its columns line up. The game has none, so
-- one ships in Media (Noto Sans Mono, SIL Open Font License, see NotoSansMono-OFL.txt).
local MONO = "Interface\\AddOns\\T3Code\\Media\\NotoSansMono-Regular.ttf"

T.LAYOUT = {
	padX = 12,       -- text inset from the list's edges
	lineLength = 38, -- prose wraps at this many times the text size, about 75 characters,
	                 -- even when the list is wider. Code and tables keep the whole width.
	listTop = 2,     -- space above the first row and under the last
	listBottom = 10,
	headHeight = 20, -- the "agent 21:23" line
	messageGap = 14, -- space above a message's header
	indent = 16,     -- per level of a nested list
	marker = 20,     -- room for a bullet, number or check box before an item's text
	quoteBar = 3,
	quoteIndent = 12,
	codePad = 7,     -- space between a code block's background and its text
	codeLines = 30,  -- a longer code block is drawn as several rows
	ruleHeight = 25,
	cellGap = 16,    -- between table columns
	cellPad = 4,     -- above and under a table row's text
	minColumn = 70,  -- a table whose wide columns would get less than this is drawn as lines
	-- Space under a block, by what follows it.
	gap = 13,        -- between blocks
	gapList = 6,     -- between items of a list, and between a line and the list under it
	gapItemText = 9, -- above a further paragraph of the same list item
	gapHeading = 6,  -- under a heading
	aboveHeading = 6, -- extra space above a heading
	-- One wheel notch scrolls twice this many lines of body text (the scroll box's own
	-- rule): six lines, a quarter of the list at its usual height. BuildStyle turns it
	-- into `pan`, so the step follows the text size.
	panLines = 3,
	userTint = { 1, 0.82, 0, 0.055 },
	codeBackground = { 0.115, 0.105, 0.095, 1 }, -- a panel lighter than the list behind it
	codeEdge = { 1, 1, 1, 0.14 },
	quoteBarColor = { 0.62, 0.62, 0.62, 0.8 },
	ruleColor = { 1, 1, 1, 0.2 },
}
local L = T.LAYOUT

function T:TextSize()
	return SIZES[ns.db and ns.db.settings and ns.db.settings.textSize] or SIZES.medium
end

-- `font` gives the face and shadow, `size` the height, `spacing` the gap between
-- lines, `color` the text's own colour (markup inside it can still change that).
-- `file` is a font file to use instead of the face, when the client can load it.
function T:BuildStyle()
	local s = self:TextSize()
	L.maxText = L.lineLength * s
	L.pan = L.panLines * (s + 4) -- a line of body text is its size and its spacing
	if self.view and self.view.SetPanExtent then self.view:SetPanExtent(L.pan) end
	self.heightFix = {} -- corrected row heights belong to the size they were measured at
	self.STYLE = {
		p = { font = "GameFontHighlight", size = s, spacing = 4, color = BODY },
		li = { font = "GameFontHighlight", size = s, spacing = 4, color = BODY },
		h1 = { font = "GameFontNormal", size = s + 6, spacing = 3, color = WHITE },
		h2 = { font = "GameFontNormal", size = s + 4, spacing = 3, color = WHITE },
		h3 = { font = "GameFontNormal", size = s + 2, spacing = 3, color = WHITE },
		code = { font = "GameFontHighlight", file = MONO, size = s - 1, spacing = 3, color = { 0.84, 0.93, 0.9 } },
		quote = { font = "GameFontHighlight", size = s, spacing = 4, color = { 0.62, 0.62, 0.6 } },
		cell = { font = "GameFontHighlight", size = s - 1, spacing = 2, color = BODY },
		cellHead = { font = "GameFontNormal", size = s - 1, spacing = 2, color = WHITE },
		marker = { font = "GameFontNormal", size = s, spacing = 4, color = GOLD },
		label = { font = "GameFontNormalSmall", size = s - 3, spacing = 0, color = GOLD },
		time = { font = "GameFontDisableSmall", size = s - 3, spacing = 0, color = { 0.5, 0.5, 0.5 } },
		hint = { font = "GameFontDisableSmall", size = s - 2, spacing = 0, color = { 0.55, 0.55, 0.53 } },
		note = { font = "GameFontNormal", size = 12, spacing = 0, color = GOLD },
	}
	return self.STYLE
end
T:BuildStyle()
-- The saved text size is only known once the addon's settings have loaded.
ns:On("Loaded", function() T:BuildStyle() end)

local function ApplyStyle(fs, name)
	local st = T.STYLE[name]
	fs:SetFontObject(st.font)
	-- A client that won't take the file may raise instead of returning false. Either
	-- way the game's font is used, and the hello (which asks HasMono) still goes out.
	local loaded = false
	if st.file then
		local ok, set = pcall(fs.SetFont, fs, st.file, st.size, "")
		loaded = ok and set and true or false
		T.mono = loaded
	end
	if not loaded then
		local object = _G[st.font]
		local path, _, flags = nil, nil, nil
		if object and object.GetFont then path, _, flags = object:GetFont() end
		if path then fs:SetFont(path, st.size, flags or "") end
	end
	fs:SetSpacing(st.spacing)
	fs:SetTextColor(st.color[1], st.color[2], st.color[3])
end

---------------------------------------------------------------------------
-- Measuring text so rows get the right height

local measurer

local function Measurer(style)
	if not measurer then
		measurer = UIParent:CreateFontString(nil, "BACKGROUND", "GameFontHighlight")
		measurer:SetPoint("TOPLEFT", UIParent, "TOPLEFT", -5000, 5000)
		measurer:SetJustifyH("LEFT")
		if measurer.SetNonSpaceWrap then measurer:SetNonSpaceWrap(true) end
		measurer:SetAlpha(0)
	end
	ApplyStyle(measurer, style)
	return measurer
end

-- Whether the client loaded the fixed-width font. The bridge is told (hello flag
-- "m"), and then leaves the characters only that font has in code blocks.
function T:HasMono()
	if self.mono == nil then Measurer("code") end
	return self.mono == true
end

-- The height `text` takes when wrapped to `width`.
local function Measure(text, width, style)
	local m = Measurer(style)
	m:SetWidth(width)
	m:SetText(text)
	return math.ceil(m:GetStringHeight())
end

-- The width `text` takes on one line.
local function MeasureWidth(text, style)
	local m = Measurer(style)
	m:SetWidth(0)
	m:SetText(text)
	return math.ceil((m.GetUnboundedStringWidth and m:GetUnboundedStringWidth()) or m:GetStringWidth() or 0)
end

function T:BodyWidth()
	local w = self.scrollBox and self.scrollBox:GetWidth() or 560
	if w < 100 then w = 560 end
	return w - L.padX * 2
end

---------------------------------------------------------------------------
-- Element initializers

local function Texture(frame, layer)
	local t = frame:CreateTexture(nil, layer or "BACKGROUND")
	t:Hide()
	return t
end

-- The wash behind your own messages, from `top` down to the row's bottom edge.
local function ShowTint(frame, ed)
	if not frame.Tint then frame.Tint = Texture(frame, "BACKGROUND") end
	frame.Tint:SetShown(ed.role == "u")
	if ed.role ~= "u" then return end
	frame.Tint:ClearAllPoints()
	frame.Tint:SetPoint("TOPLEFT", 2, -(ed.tintTop or 0))
	frame.Tint:SetPoint("BOTTOMRIGHT", -2, 0)
	frame.Tint:SetColorTexture(unpack(L.userTint))
end

-- If the real text is taller than estimated (font or scale differences), grow the
-- row and lay the list out again rather than letting the next row overlap it.
local function FitHeight(ed, textHeight)
	local needed = ed.height - ed.textHeight + math.ceil(textHeight)
	if needed > ed.height + 1 and ed.fixKey then
		T.heightFix[ed.fixKey] = math.ceil(textHeight)
		ed.textHeight, ed.height = math.ceil(textHeight), needed
		if not T.reflowQueued then
			T.reflowQueued = true
			C_Timer.After(0, function()
				T.reflowQueued = nil
				T:Reflow()
			end)
		end
	end
end

local function InitHead(frame, ed)
	if not frame.Label then
		frame.Label = frame:CreateFontString(nil, "ARTWORK", "GameFontNormalSmall")
		frame.Speak = UI.IconButton(frame, "voicechat-icon-speaker", 18, nil, nil)
		frame.Speak.Background:Hide()
		frame.Speak:SetAlpha(0.8)
		UI.Tooltip(frame.Speak, "Read aloud")
		frame.Time = frame:CreateFontString(nil, "ARTWORK", "GameFontDisableSmall")
	end
	local m = ed.msg
	ShowTint(frame, ed)
	ApplyStyle(frame.Label, "label")
	ApplyStyle(frame.Time, "time")
	frame.Label:ClearAllPoints()
	frame.Label:SetPoint("BOTTOMLEFT", L.padX, 5)
	frame.Label:SetText(ed.label)
	frame.Speak:ClearAllPoints()
	frame.Speak:SetPoint("BOTTOMRIGHT", -8, 2)
	frame.Speak:SetShown(m.r == "a")
	frame.Speak:SetScript("OnClick", function() ns.Speak(T.PlainText(m), ns.viewId, m.n) end)
	frame.Time:ClearAllPoints()
	if m.r == "a" then
		frame.Time:SetPoint("RIGHT", frame.Speak, "LEFT", -6, 0)
	else
		frame.Time:SetPoint("BOTTOMRIGHT", -L.padX, 5)
	end
	frame.Time:SetText(ed.time)
end

-- One block of a message: a paragraph, heading, list item, code, quote or rule.
local function InitBlock(frame, ed)
	if not frame.Text then
		frame.Edge = Texture(frame, "BACKGROUND")
		frame.Edge:SetDrawLayer("BACKGROUND", 1)
		frame.Back = Texture(frame, "BACKGROUND")
		frame.Back:SetDrawLayer("BACKGROUND", 2)
		frame.Bar = Texture(frame, "ARTWORK")
		frame.Check = Texture(frame, "ARTWORK")
		frame.Tick = Texture(frame, "OVERLAY")
		frame.Marker = frame:CreateFontString(nil, "ARTWORK", "GameFontNormal")
		frame.Marker:SetJustifyH("RIGHT")
		frame.Text = frame:CreateFontString(nil, "ARTWORK", "GameFontHighlight")
		frame.Text:SetJustifyH("LEFT")
		frame.Text:SetJustifyV("TOP")
		-- A path or a URL longer than the line still wraps.
		if frame.Text.SetNonSpaceWrap then frame.Text:SetNonSpaceWrap(true) end
	end
	ShowTint(frame, ed)
	local style = ed.style
	frame.Edge:Hide()
	frame.Back:Hide()
	frame.Bar:Hide()
	frame.Check:Hide()
	frame.Tick:Hide()
	frame.Marker:Hide()
	frame.Text:SetShown(style ~= "hr")
	if style == "hr" then
		frame.Bar:ClearAllPoints()
		-- As wide as the prose it divides, not the whole list.
		frame.Bar:SetPoint("LEFT", L.padX, 0)
		frame.Bar:SetWidth(math.min(T:BodyWidth(), L.maxText))
		frame.Bar:SetHeight(1)
		frame.Bar:SetColorTexture(unpack(L.ruleColor))
		frame.Bar:Show()
		return
	end
	local left = L.padX + ed.indent
	if style == "code" then
		-- A panel with a one-unit edge: the edge is a rectangle, the panel sits on it.
		-- A long block is several rows; only its first and last close the edge.
		frame.Edge:ClearAllPoints()
		frame.Edge:SetPoint("TOPLEFT", left, -ed.top + (ed.open and L.codePad or 0))
		frame.Edge:SetPoint("BOTTOMRIGHT", -L.padX, ed.bottom - (ed.close and L.codePad or 0))
		frame.Edge:SetColorTexture(unpack(L.codeEdge))
		frame.Edge:Show()
		frame.Back:ClearAllPoints()
		frame.Back:SetPoint("TOPLEFT", frame.Edge, "TOPLEFT", 1, ed.open and -1 or 0)
		frame.Back:SetPoint("BOTTOMRIGHT", frame.Edge, "BOTTOMRIGHT", -1, ed.close and 1 or 0)
		frame.Back:SetColorTexture(unpack(L.codeBackground))
		frame.Back:Show()
		left = left + L.codePad
	elseif style == "quote" and ed.bar then
		frame.Bar:ClearAllPoints()
		frame.Bar:SetPoint("TOPLEFT", left - L.quoteIndent, -ed.top)
		frame.Bar:SetPoint("BOTTOMLEFT", left - L.quoteIndent, ed.joined and 0 or ed.bottom)
		frame.Bar:SetWidth(L.quoteBar)
		frame.Bar:SetColorTexture(unpack(L.quoteBarColor))
		frame.Bar:Show()
	elseif style == "li" and ed.marker ~= "" then
		if ed.marker == "[ ]" or ed.marker == "[x]" then
			-- The game's check box art has a wide empty margin, so it is drawn larger
			-- than the text and pulled up to sit on the first line.
			local size = T.STYLE.li.size + 7
			for _, tex in ipairs({ frame.Check, frame.Tick }) do
				tex:ClearAllPoints()
				tex:SetPoint("TOPRIGHT", frame, "TOPLEFT", left - 2, -ed.top + 4)
				tex:SetSize(size, size)
			end
			frame.Check:SetTexture("Interface\\Buttons\\UI-CheckBox-Up")
			frame.Check:Show()
			frame.Tick:SetTexture("Interface\\Buttons\\UI-CheckBox-Check")
			frame.Tick:SetShown(ed.marker == "[x]")
		else
			ApplyStyle(frame.Marker, "marker")
			frame.Marker:ClearAllPoints()
			frame.Marker:SetPoint("TOPRIGHT", frame, "TOPLEFT", left - 6, -ed.top)
			frame.Marker:SetText(ed.marker)
			frame.Marker:Show()
		end
	end
	ApplyStyle(frame.Text, style)
	frame.Text:ClearAllPoints()
	frame.Text:SetPoint("TOPLEFT", left, -ed.top)
	frame.Text:SetWidth(ed.width)
	frame.Text:SetText(ed.text)
	FitHeight(ed, frame.Text:GetStringHeight())
end

-- One row of a table: a font string per column.
local function InitTableRow(frame, ed)
	if not frame.Cells then
		frame.Cells = {}
		frame.Line = Texture(frame, "ARTWORK")
	end
	ShowTint(frame, ed)
	local x = L.padX
	local tallest = 0
	for i, text in ipairs(ed.cells) do
		local cell = frame.Cells[i]
		if not cell then
			cell = frame:CreateFontString(nil, "ARTWORK", "GameFontHighlight")
			cell:SetJustifyV("TOP")
			if cell.SetNonSpaceWrap then cell:SetNonSpaceWrap(true) end
			frame.Cells[i] = cell
		end
		ApplyStyle(cell, ed.head and "cellHead" or "cell")
		local align = ed.align:sub(i, i)
		cell:SetJustifyH(align == "r" and "RIGHT" or align == "c" and "CENTER" or "LEFT")
		cell:ClearAllPoints()
		cell:SetPoint("TOPLEFT", x, -ed.top)
		cell:SetWidth(ed.widths[i])
		cell:SetText(text)
		cell:Show()
		tallest = math.max(tallest, cell:GetStringHeight() or 0)
		x = x + ed.widths[i] + L.cellGap
	end
	for i = #ed.cells + 1, #frame.Cells do frame.Cells[i]:Hide() end
	-- A line under the header row and a fainter one under each row after it.
	frame.Line:ClearAllPoints()
	frame.Line:SetPoint("BOTTOMLEFT", L.padX, ed.bottom - L.cellPad)
	frame.Line:SetPoint("BOTTOMRIGHT", frame, "BOTTOMLEFT", x - L.cellGap, ed.bottom - L.cellPad)
	frame.Line:SetHeight(1)
	frame.Line:SetColorTexture(1, 1, 1, ed.head and 0.3 or 0.08)
	frame.Line:Show()
	FitHeight(ed, tallest)
end

local function InitNote(frame, ed)
	if not frame.Text then
		frame.Icon = frame:CreateTexture(nil, "ARTWORK")
		frame.Icon:SetSize(16, 16)
		frame.Icon:SetPoint("TOPLEFT", L.padX, -6)
		frame.Text = frame:CreateFontString(nil, "ARTWORK", "GameFontNormal")
		frame.Text:SetPoint("TOPLEFT", frame.Icon, "TOPRIGHT", 6, 0)
		frame.Text:SetJustifyH("LEFT")
		frame.Text:SetJustifyV("TOP")
		frame.Anim = frame.Icon:CreateAnimationGroup()
		local rot = frame.Anim:CreateAnimation("Rotation")
		rot:SetDegrees(-360)
		rot:SetDuration(1.4)
		frame.Anim:SetLooping("REPEAT")
	end
	frame.Text:SetWidth(T:BodyWidth() - 22)
	local text = ed.text
	if ed.since then text = string.format("%s  |cff9d9d9d(%s)|r", text, ns.Duration(time() - ed.since)) end
	frame.Text:SetText(text)
	frame.Icon:SetAtlas(ed.icon or "common-icon-forwardarrow")
	if ed.spin then frame.Anim:Play() else frame.Anim:Stop() end
end

local function InitOption(button, ed)
	if not button.Label then
		button.Bullet = button:CreateTexture(nil, "ARTWORK")
		button.Bullet:SetSize(10, 10)
		button.Bullet:SetPoint("LEFT", L.padX + 6, 0)
		button.Label = button:CreateFontString(nil, "ARTWORK", "GameFontNormal")
		button.Label:SetPoint("LEFT", button.Bullet, "RIGHT", 8, 0)
		button.Label:SetPoint("RIGHT", -8, 0)
		button.Label:SetJustifyH("LEFT")
		button.Label:SetWordWrap(false)
		local hl = button:CreateTexture(nil, "HIGHLIGHT")
		hl:SetAtlas("Options_List_Hover")
		hl:SetAllPoints()
		hl:SetAlpha(0.5)
		button:SetScript("OnEnter", function(self)
			if not self.desc or self.desc == "" then return end
			GameTooltip:SetOwner(self, "ANCHOR_RIGHT")
			GameTooltip:SetText(self.Label:GetText(), 1, 0.82, 0)
			GameTooltip:AddLine(self.desc, 1, 1, 1, true)
			GameTooltip:Show()
		end)
		button:SetScript("OnLeave", function() GameTooltip:Hide() end)
	end
	button.desc = ed.desc
	if ed.checked ~= nil then
		button.Bullet:SetTexture(ed.checked and "Interface\\Buttons\\UI-CheckBox-Check" or "Interface\\Buttons\\UI-CheckBox-Up")
		button.Bullet:SetSize(16, 16)
	else
		button.Bullet:SetTexture("Interface\\Buttons\\WHITE8X8")
		button.Bullet:SetVertexColor(0.9, 0.9, 0.9)
		button.Bullet:SetSize(7, 7)
	end
	button.Label:SetText(ed.label)
	-- `quiet` options are offers, not part of a question: they stay in the body's colour.
	if ed.primary then button.Label:SetTextColor(1, 1, 1)
	elseif ed.quiet then button.Label:SetTextColor(BODY[1], BODY[2], BODY[3])
	else button.Label:SetTextColor(NORMAL_FONT_COLOR:GetRGB()) end
	button:SetScript("OnClick", function()
		PlaySound(SOUNDKIT.IG_MAINMENU_OPTION_CHECKBOX_ON)
		ed.onClick()
	end)
end

---------------------------------------------------------------------------

function T:Create(parent, header, composer)
	local inset = UI.Inset(parent)
	inset:SetPoint("TOPLEFT", header, "BOTTOMLEFT", -2, -4)
	inset:SetPoint("BOTTOMRIGHT", composer, "TOPRIGHT", 0, 4)
	self.inset = inset

	local scrollBox = CreateFrame("Frame", nil, inset, "WowScrollBoxList")
	scrollBox:SetPoint("TOPLEFT", 4, -4)
	scrollBox:SetPoint("BOTTOMRIGHT", -20, 4)
	local scrollBar = CreateFrame("EventFrame", nil, inset, "MinimalScrollBar")
	scrollBar:SetPoint("TOPLEFT", scrollBox, "TOPRIGHT", 4, 0)
	scrollBar:SetPoint("BOTTOMLEFT", scrollBox, "BOTTOMRIGHT", 4, 0)

	-- No spacing between rows: each row carries its own, so the wash behind your
	-- messages runs unbroken from one row to the next.
	local view = CreateScrollBoxListLinearView(L.listTop, L.listBottom, 0, 0, 0)
	view:SetElementFactory(function(factory, ed)
		if ed.kind == "head" then factory("T3CodeMessageRowTemplate", InitHead)
		elseif ed.kind == "block" then factory("T3CodeBlockRowTemplate", InitBlock)
		elseif ed.kind == "trow" then factory("T3CodeTableRowTemplate", InitTableRow)
		elseif ed.kind == "option" then factory("T3CodeOptionRowTemplate", InitOption)
		else factory("T3CodeNoteRowTemplate", InitNote) end
	end)
	view:SetElementExtentCalculator(function(_, ed) return ed.height or 24 end)
	-- Left alone, the scroll box takes its wheel step from the first row it was ever
	-- given, so one notch could be a line or a screen.
	if view.SetPanExtent then view:SetPanExtent(L.pan) end
	ScrollUtil.InitScrollBoxListWithScrollBar(scrollBox, scrollBar, view)
	self.scrollBox, self.scrollBar, self.view = scrollBox, scrollBar, view

	scrollBox:SetScript("OnSizeChanged", function() T:Relayout() end)
end

function T:Relayout()
	self.key = nil
	if ns.Main.frame and ns.Main.frame:IsShown() then self:Refresh() end
end

-- The bridge reformats messages (markdown, escapes), so the echo is matched by
-- time, not text: it goes once a message of yours arrives that is newer than the
-- newest message shown when you sent it. Both times come from T3 Code's clock.
-- (Message numbers won't do: T3 Code sends a bounded window and renumbers it.)
function T:AddLocalEcho(threadId, text)
	local after
	local v = ns.Store.data.view
	if v and v.id == threadId and not v.loading then
		after = 0
		for _, m in ipairs(v.msgs or {}) do
			if type(m.at) == "number" and m.at > after then after = m.at end
		end
	end
	self.echo[threadId] = { text = text, at = time(), after = after }
	self.followBottom = true
	self:Refresh(true)
end

---------------------------------------------------------------------------
-- Building the element list

-- T.heightFix: corrected row heights, by text and width (emptied by BuildStyle).

-- Without the thread's messages at send time, compare with this PC's clock, with
-- slack for a T3 Code server whose clock differs.
local function EchoArrived(echo, m)
	if echo.after then return type(m.at) == "number" and m.at > echo.after end
	return type(m.at) == "number" and m.at >= echo.at - 30
end

-- What a message says, without markup: for reading aloud.
function T.PlainText(m)
	if m.t then return m.t end
	local parts = {}
	for _, b in ipairs(m.b or {}) do
		local last = b[#b]
		if type(last) == "table" then
			for _, row in ipairs(last) do parts[#parts + 1] = table.concat(row, ", ") end
		elseif b[1] ~= "r" then
			parts[#parts + 1] = last
		end
	end
	return table.concat(parts, "\n")
end

local function TextBlock(list, role, style, text, o)
	o = o or {}
	local indent = o.indent or 0
	-- Code keeps the whole width: its lines are meant to stay whole.
	local width = T:BodyWidth() - indent
	if style == "code" then width = width - L.codePad * 2 else width = math.min(width, L.maxText - indent) end
	local fixKey = style .. ":" .. math.floor(width) .. ":" .. text
	local e = {
		kind = "block", role = role, style = style, text = text, indent = indent, width = width,
		marker = o.marker, bar = o.bar, open = o.open, close = o.close, top = o.top or 0, bottom = o.bottom or 0,
		textHeight = math.max(Measure(text, width, style), T.heightFix[fixKey] or 0), fixKey = fixKey,
	}
	table.insert(list, e)
	return e
end

-- A code block keeps its lines; a long one is several rows under one background.
local function CodeBlock(list, role, depth, text)
	local lines = {}
	for line in (text .. "\n"):gmatch("(.-)\n") do lines[#lines + 1] = line end
	local indent = depth > 0 and L.marker + (depth - 1) * L.indent or 0
	for from = 1, math.max(1, #lines), L.codeLines do
		local to = math.min(#lines, from + L.codeLines - 1)
		local open, close = from == 1, to >= #lines
		TextBlock(list, role, "code", table.concat(lines, "\n", from, to), {
			indent = indent, open = open, close = close,
			top = open and L.codePad or 0, bottom = close and L.codePad or 0,
		})
	end
end

-- Each column as wide as its widest cell. When that doesn't fit, the columns narrower
-- than an equal share of the room keep their width, and the wide ones share what is
-- left by how wide each wants to be. Nil when a column would get less than
-- `minColumn`. (tools/preview/page.js repeats this rule.)
local function ColumnWidths(rows, avail)
	local n = #rows[1]
	local room = avail - L.cellGap * (n - 1)
	local natural, sum = {}, 0
	for c = 1, n do
		local w = 0
		for r, row in ipairs(rows) do w = math.max(w, MeasureWidth(row[c] or "", r == 1 and "cellHead" or "cell")) end
		natural[c] = w + 2
		sum = sum + natural[c]
	end
	if sum <= room then return natural end
	local widths, left, wide = {}, room, n
	local settled = true
	while settled and wide > 0 do
		settled = false
		for c = 1, n do
			if not widths[c] and natural[c] <= left / wide then
				widths[c] = natural[c]
				left = left - natural[c]
				wide = wide - 1
				settled = true
			end
		end
	end
	local want = 0
	for c = 1, n do if not widths[c] then want = want + natural[c] end end
	for c = 1, n do
		if not widths[c] then
			widths[c] = math.floor(left * natural[c] / want)
			if widths[c] < L.minColumn then return nil end
		end
	end
	return widths
end

local tableCount = 0

local function TableRows(list, role, align, rows)
	if type(rows) ~= "table" or not rows[1] then return end
	local widths = ColumnWidths(rows, T:BodyWidth())
	if not widths then
		-- Too many columns for the window: each row as "heading: value" lines.
		for r = 2, #rows do
			local lines = {}
			for c, cell in ipairs(rows[r]) do
				-- The header loses its own colours: a colour inside a colour ends the outer one.
				local name = (rows[1][c] or ""):gsub("|c%x%x%x%x%x%x%x%x", ""):gsub("|r", "")
				if cell ~= "" then lines[#lines + 1] = ns.Color("gold", name) .. "  " .. cell end
			end
			TextBlock(list, role, "p", table.concat(lines, "\n"))
		end
		return
	end
	tableCount = tableCount + 1
	for r, cells in ipairs(rows) do
		local textHeight = 0
		for c = 1, #widths do
			textHeight = math.max(textHeight, Measure(cells[c] or "", widths[c], r == 1 and "cellHead" or "cell"))
		end
		local fixKey = "t:" .. math.floor(T:BodyWidth()) .. ":" .. table.concat(cells, "\031")
		table.insert(list, {
			kind = "trow", style = "trow", role = role, cells = cells, widths = widths, align = align or "", head = r == 1,
			table = tableCount, top = L.cellPad, bottom = L.cellPad,
			textHeight = math.max(textHeight, T.heightFix[fixKey] or 0), fixKey = fixKey,
		})
	end
end

-- The rows for a message's blocks (see bridge/src/format.js for the block shapes),
-- with the space under each decided by what follows it.
function T:AddBlocks(list, role, blocks)
	local first = #list + 1
	for _, b in ipairs(blocks) do
		local k = b[1]
		if k == "p" then
			TextBlock(list, role, "p", b[2] or "")
		elseif k == "h" then
			TextBlock(list, role, "h" .. math.max(1, math.min(3, tonumber(b[2]) or 1)), b[3] or "")
		elseif k == "l" then
			TextBlock(list, role, "li", b[4] or "", { indent = L.marker + (tonumber(b[2]) or 0) * L.indent, marker = b[3] or "" })
		elseif k == "c" then
			CodeBlock(list, role, tonumber(b[2]) or 0, b[3] or "")
		elseif k == "q" then
			local depth = tonumber(b[2]) or 0
			TextBlock(list, role, "quote", b[3] or "", { indent = depth * L.quoteIndent, bar = depth > 0 })
		elseif k == "r" then
			table.insert(list, { kind = "block", role = role, style = "hr", text = "", indent = 0, width = 0, top = 0, bottom = 0, textHeight = L.ruleHeight })
		elseif k == "t" then
			TableRows(list, role, b[2], b[3])
		end
	end
	for i = first, #list do
		local e, nxt = list[i], list[i + 1]
		local gap = L.gap
		if not nxt then
			gap = 6
		elseif e.style == "hr" or nxt.style == "hr" then
			gap = 0
		elseif e.style == "code" and not e.close then
			gap = 0
		elseif e.style == "trow" and nxt.style == "trow" and e.table == nxt.table then
			gap = 0
		elseif e.style:sub(1, 1) == "h" then
			gap = L.gapHeading
		elseif nxt.style == "li" and nxt.marker == "" then
			gap = L.gapItemText
		elseif nxt.style == "li" and (e.style == "li" or e.style == "p") then
			gap = L.gapList
		elseif e.style == "quote" and nxt.style == "quote" then
			gap = L.gapItemText
			e.joined = true -- the bar runs on into the next row
		end
		if nxt and gap > 0 and nxt.style:sub(1, 1) == "h" and nxt.style ~= "hr" then gap = gap + L.aboveHeading end
		e.bottom = e.bottom + gap
		e.height = e.top + e.textHeight + e.bottom
	end
end

local function AddMessage(list, msg, echo)
	local role = msg.r == "u" and "u" or "a"
	local label
	if role == "u" then
		label = ns.Color("gold", echo and "you  |cff9d9d9d(sending…)|r" or "you")
	else
		label = ns.Color("agent", "agent") .. (msg.live and ns.Color("grey", "  writing…") or "")
	end
	table.insert(list, {
		kind = "head", role = role, msg = msg, echo = echo, label = label, time = msg.at and date("%H:%M", msg.at) or "",
		tintTop = L.messageGap, height = L.messageGap + L.headHeight,
	})
	-- A bridge that predates blocks sends the whole message as one font string.
	T:AddBlocks(list, role, msg.b or { { "p", msg.t or "" } })
end

local function Note(text, icon, opts)
	local width = T:BodyWidth() - 22
	local e = { kind = "note", text = text, icon = icon, height = 14 + math.max(16, Measure(text, width, "note")) }
	if opts then for k, v in pairs(opts) do e[k] = v end end
	return e
end

local function Option(label, onClick, desc, extra)
	local e = { kind = "option", label = label, onClick = onClick, desc = desc, height = 26 }
	if extra then for k, v in pairs(extra) do e[k] = v end end
	return e
end

function T:AnswerQuestion(view, pending, q, value)
	local req = self.answers[pending.id] or {}
	self.answers[pending.id] = req
	if q.multi then
		req[q.id] = req[q.id] or {}
		req[q.id][value] = not req[q.id][value] or nil
	else
		req[q.id] = { [value] = true }
	end
	-- Single question, single choice: answer right away.
	if #pending.questions == 1 and not q.multi then
		self:SubmitAnswers(view.id, pending)
	else
		self:Refresh(true)
	end
end

function T:SubmitAnswers(threadId, pending, customText)
	local req = self.answers[pending.id] or {}
	local args = {}
	for _, q in ipairs(pending.questions) do
		local chosen = req[q.id]
		if chosen then
			for value in pairs(chosen) do
				table.insert(args, q.id)
				table.insert(args, value)
			end
		elseif customText and customText ~= "" then
			table.insert(args, q.id)
			table.insert(args, customText)
		end
	end
	if #args == 0 then return false end
	ns.Transport:Send("answer", threadId, pending.id, unpack(args))
	self.answered = self.answered or {}
	self.answered[pending.id] = true
	self:Refresh(true)
	return true
end

-- Called by the composer when a question is open and the player types an answer.
function T:CustomAnswer(text)
	local v = ns.Store:View()
	local p = v and v.pending
	if not p or p.kind ~= "question" then return false end
	for _, q in ipairs(p.questions) do
		if q.custom then return self:SubmitAnswers(v.id, p, text) end
	end
	return false
end

function T:Elements()
	local list = {}
	local main = ns.Main
	if main.mode == "new" then
		table.insert(list, Note(ns.Color("gold", "Start a new thread") .. "\n\nPick the project above, describe the task in the box below and press "
			.. ns.Color("white", "Start") .. ". The agent runs on your computer with your T3 Code defaults.", "common-icon-forwardarrow"))
		return list
	end
	local id = ns.viewId
	if not id then
		local b = ns.Store.data.bridge or {}
		local lines = { ns.Color("gold", "T3 Code") .. (b.host and ns.Color("grey", "  on " .. b.host) or "") }
		local active = ns.Store:Active()
		if #active > 0 then
			table.insert(lines, string.format("\n%d thread%s need%s you or %s working.", #active, #active == 1 and "" or "s", #active == 1 and "s" or "", #active == 1 and "is" or "are"))
		end
		table.insert(lines, "\nPick a thread on the left to read it and reply, or start a new one.")
		if ns.Gamepad:IsActive() then
			table.insert(lines, "\n" .. ns.Gamepad:HelpText())
		end
		table.insert(list, Note(table.concat(lines, "\n"), "common-icon-forwardarrow"))
		return list
	end

	local t = ns.Store:Thread(id)
	local v = ns.Store:View()
	if not v then
		table.insert(list, Note(ns.Color("grey", "Loading…"), "common-icon-undo", { spin = true }))
		return list
	end
	if v.loading then
		table.insert(list, Note(ns.Color("grey", "Loading…"), "common-icon-undo", { spin = true }))
		return list
	end
	if v.more then
		table.insert(list, Note(ns.Color("grey", "Earlier messages are in T3 Code."), "common-icon-undo"))
	end
	local echo = self.echo[id]
	for _, m in ipairs(v.msgs or {}) do
		AddMessage(list, m)
		if echo and m.r == "u" and EchoArrived(echo, m) then
			self.echo[id] = nil
			echo = nil
		end
	end
	if echo and time() - echo.at < 120 then
		AddMessage(list, { r = "u", t = echo.text:gsub("|", "||"), at = echo.at }, true)
	end

	if v.err and t and t.s == "failed" then
		table.insert(list, Note(ns.Color("red", v.err), "common-icon-redx"))
	end

	local p = v.pending
	if p and not (self.answered and self.answered[p.id]) then
		if p.kind == "approval" then
			local body = ns.Color("orange", "The agent wants to " .. p.what:lower() .. ":")
			if p.files then
				for _, f in ipairs(p.files) do
					local delta = ""
					if f.a or f.d then delta = "  " .. ns.Color("green", "+" .. (f.a or 0)) .. " " .. ns.Color("red", "-" .. (f.d or 0)) end
					body = body .. "\n" .. ns.Color("white", f.f) .. delta
				end
			elseif p.detail ~= "" then
				body = body .. "\n" .. ns.Color("white", p.detail)
			end
			table.insert(list, Note(body, "common-icon-forwardarrow"))
			local function Approve(decision)
				return function()
					ns.Transport:Send("approve", id, p.id, decision)
					self.answered = self.answered or {}
					self.answered[p.id] = true
					self:Refresh(true)
				end
			end
			table.insert(list, Option("Approve", Approve("accept"), nil, { primary = true }))
			table.insert(list, Option("Approve for this session", Approve("acceptForSession")))
			if p.always then
				table.insert(list, Option("Always allow this", Approve("acceptAlways"), "Don't ask again for this command."))
			end
			table.insert(list, Option("Decline", Approve("decline")))
		elseif p.kind == "question" then
			local req = self.answers[p.id] or {}
			local custom = false
			for _, q in ipairs(p.questions) do
				local head = q.h and q.h ~= "" and (ns.Color("gold", q.h) .. "\n") or ""
				table.insert(list, Note(head .. ns.Color("white", q.q), "common-icon-forwardarrow"))
				for _, o in ipairs(q.opts) do
					local checked
					if q.multi or #p.questions > 1 then checked = (req[q.id] and req[q.id][o.v]) and true or false end
					table.insert(list, Option(o.l, function() T:AnswerQuestion(v, p, q, o.v) end, o.d, { checked = checked }))
				end
				if q.custom then custom = true end
			end
			if #p.questions > 1 or (p.questions[1] and p.questions[1].multi) then
				table.insert(list, Option("Submit answers", function() T:SubmitAnswers(id, p) end, nil, { primary = true }))
			end
			if custom then
				table.insert(list, Note(ns.Color("grey", "Or type your own answer below and press Send."), "common-icon-forwardarrow"))
			end
		end
	elseif t and t.s == "plan" then
		if v.pb then
			table.insert(list, Note(ns.Color("orange", "The agent has a plan ready:"), "common-icon-forwardarrow"))
			self:AddBlocks(list, "a", v.pb)
		else
			table.insert(list, Note(ns.Color("orange", "The agent has a plan ready") .. (v.plan and (":\n\n" .. v.plan) or "."), "common-icon-forwardarrow"))
		end
		table.insert(list, Option("Read the plan aloud", function() ns.Speak(v.plan or T.PlainText({ b = v.pb }), id, "plan") end))
		table.insert(list, Option("Implement the plan", function() ns.Main:Send("Implement the plan.") end, nil, { primary = true }))
		table.insert(list, Option("Explain the plan more simply", function() ns.Main:Send("Explain the plan more simply.") end))
	end

	if v.sum then
		table.insert(list, Note(ns.Color("grey", v.sum), "common-icon-checkmark"))
	end
	if v.queued then
		table.insert(list, Note(ns.Color("orange", v.queued .. (v.queued == 1 and " follow-up is" or " follow-ups are") .. " queued until this run finishes."), "common-icon-undo"))
	end
	if t and (t.s == "working" or t.run) then
		table.insert(list, Note(ns.Color("agent", (t.run and t.l) or v.act or t.l or "Working"), "common-icon-undo", { spin = true, since = t.st, live = true }))
	elseif t and (t.s == "open" or t.s == "failed" or t.s == "waiting") and ns.db.settings.quickReplies and not p then
		-- A label and a quieter colour, so the offers don't read as the end of the answer.
		TextBlock(list, "a", "hint", "Quick replies", { top = L.gap, bottom = 3 })
		list[#list].height = list[#list].top + list[#list].textHeight + list[#list].bottom
		for _, text in ipairs(QUICK_REPLIES) do
			table.insert(list, Option(text:gsub("%.$", ""), function() ns.Main:Send(text) end, nil, { quiet = true }))
		end
	end
	return list
end

-- Re-measure rows with the same elements (after a height correction).
function T:Reflow()
	if not self.scrollBox or not self.dp then return end
	local atBottom = not self.scrollBox:HasScrollableExtent() or self.scrollBox:GetScrollPercentage() > 0.97
	self.scrollBox:SetDataProvider(self.dp, ScrollBoxConstants.RetainScrollPosition)
	if atBottom then self.scrollBox:ScrollToEnd(ScrollBoxConstants.NoScrollInterpolation) end
end

function T:Refresh(force)
	if not self.scrollBox then return end
	local echo = ns.viewId and self.echo[ns.viewId]
	-- What the rows show besides the transcript itself: quick replies and the failed
	-- note follow the thread's status, and with no thread picked the note counts the
	-- active threads and names the machine. None of that is part of the transcript the
	-- bridge sends, so it goes in the key.
	local t = ns.Store:Thread(ns.viewId)
	local context
	if ns.viewId then
		context = t and ((t.s or "") .. "|" .. (t.l or "")) or "gone"
	else
		context = (ns.Store.listKey or "") .. "|" .. tostring((ns.Store.data.bridge or {}).host or "")
			.. "|" .. tostring(ns.Gamepad and ns.Gamepad:IsActive())
	end
	local key = table.concat({
		tostring(ns.viewId), ns.Store.viewKey or "", ns.Main.mode, context,
		echo and time() - echo.at < 120 and echo.at or 0, math.floor(self:BodyWidth()),
	}, ":")
	if key == self.key and not force then
		self.scrollBox:ForEachFrame(function(frame, ed)
			if ed.live then InitNote(frame, ed) end
		end)
		return
	end
	local viewChanged = self.lastViewId ~= ns.viewId
	self.key = key
	self.lastViewId = ns.viewId
	local atBottom = viewChanged or self.followBottom or not self.scrollBox:HasScrollableExtent() or self.scrollBox:GetScrollPercentage() > 0.97
	self.followBottom = nil
	local elements = self:Elements()
	local dp = CreateDataProvider(elements)
	self.dp = dp
	self.scrollBox:SetDataProvider(dp, atBottom and ScrollBoxConstants.DiscardScrollPosition or ScrollBoxConstants.RetainScrollPosition)
	local start = self:AnswerStart(elements, viewChanged, atBottom)
	if start and self.scrollBox.ScrollToElementDataIndex then
		self.scrollBox:ScrollToElementDataIndex(start, ScrollBoxConstants.AlignBegin, 0, ScrollBoxConstants.NoScrollInterpolation)
	elseif atBottom then
		self.scrollBox:ScrollToEnd(ScrollBoxConstants.NoScrollInterpolation)
	end
	ns:Fire("TranscriptRebuilt")
end

-- Where to scroll so that a finished answer is read from its first line: the row of
-- its header, when the answer is new to this window and taller than the list. Nil
-- means the usual place, the end. An answer watched while it was being written stays
-- at the end, where the reader already is, and so does a thread that is asking
-- something, because the question is at the end. (tools/preview/page.js repeats the
-- "taller than the list" rule to draw the window as opened.)
function T:AnswerStart(elements, viewChanged, atBottom)
	local v = ns.viewId and ns.Store:View()
	local index, head
	for i = #elements, 1, -1 do
		if elements[i].kind == "head" then
			index, head = i, elements[i]
			break
		end
	end
	if not v or not head or head.role ~= "a" or head.echo then return nil end
	-- A message's time identifies it; its number changes as T3 Code's window moves.
	local key = tostring(ns.viewId) .. ":" .. tostring(head.msg.at)
	if head.msg.live then
		self.answerWatched = key
		return nil
	end
	if key == self.answerShown then return nil end
	self.answerShown = key
	if self.answerWatched == key or v.pending or not (viewChanged or atBottom) then return nil end
	local height = 0
	for i = index, #elements do height = height + (elements[i].height or 24) end
	if height <= self.scrollBox:GetHeight() then return nil end
	return index
end
