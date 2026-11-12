-- Load the addon against tools/wowstub.lua, show one thread, and write the rows the
-- transcript would draw as JSON. tools/preview/render.mjs turns that into a picture.
--   lua5.1 tools/preview/dump.lua <addon dir> <snapshot.lua> <viewId> <out.json> [list width]
-- Run from the repo root. The stub can't measure text, so row heights in the output
-- mean nothing: the picture lays text out again from each row's text and style.
local addonDir, snapshot, viewId, outPath, listWidth = arg[1], arg[2], arg[3], arg[4], tonumber(arg[5])
package.path = "./tools/?.lua;" .. package.path
local Stub = dofile("tools/wowstub.lua")
Stub.slotData.default = snapshot

local ns = {}
for line in io.lines(addonDir .. "/T3Code.toc") do
	line = line:gsub("\r", "")
	if line ~= "" and not line:match("^#") and line:match("%.lua$") then
		assert(loadfile(addonDir .. "/" .. line:gsub("\\", "/")))("T3Code", ns)
	end
end
Stub.Fire("ADDON_LOADED", "T3Code")
Stub.Fire("PLAYER_LOGIN")

local textSize = os.getenv("T3CODE_TEXT_SIZE")
if textSize and textSize ~= "" and ns.Transcript.BuildStyle then
	ns.db.settings.textSize = textSize
	ns.Transcript:BuildStyle()
end

assert(loadfile(snapshot))()
local data = T3Code_Inbox
T3Code_Inbox = nil
data.ack = { ui = ns.ui, seq = ns.Transport.stripSeq }
data.x = nil
data.gen = data.gen + 1
data.nextSig = (ns.db.sigNext or 1) + 1
ns.Transport.signals = "ok"
ns.Transport:Apply(data)
ns.Main:Open()
ns.Main:SelectThread(viewId)
ns.Store:Apply(data)
if listWidth and ns.Transcript.scrollBox then
	ns.Transcript.scrollBox._w = listWidth
	ns.Transcript:Relayout()
end

for _, e in ipairs(T3Code.errors or {}) do io.stderr:write("ADDON ERROR: " .. tostring(e.msg) .. "\n") end
assert(#(T3Code.errors or {}) == 0, "the addon recorded errors")

local function json(v, seen)
	local t = type(v)
	if t == "string" then
		return '"' .. v:gsub('[%c"\\]', function(c)
			if c == "\n" then return "\\n" elseif c == '"' then return '\\"' elseif c == "\\" then return "\\\\" end
			return string.format("\\u%04x", c:byte())
		end) .. '"'
	elseif t == "number" then
		return tostring(v)
	elseif t == "boolean" then
		return tostring(v)
	elseif t == "table" then
		seen = seen or {}
		if seen[v] or getmetatable(v) then return "null" end
		seen[v] = true
		local out = {}
		if #v > 0 or next(v) == nil then
			for _, item in ipairs(v) do out[#out + 1] = json(item, seen) end
			seen[v] = nil
			return "[" .. table.concat(out, ",") .. "]"
		end
		local keys = {}
		for k, item in pairs(v) do
			if type(k) == "string" and type(item) ~= "function" then keys[#keys + 1] = k end
		end
		table.sort(keys)
		for _, k in ipairs(keys) do out[#out + 1] = json(k) .. ":" .. json(v[k], seen) end
		seen[v] = nil
		return "{" .. table.concat(out, ",") .. "}"
	end
	return "null"
end

local T = ns.Transcript
local out = {
	elements = T:Elements(),
	bodyWidth = T:BodyWidth(),
	-- A transcript that draws blocks describes how; one that doesn't has neither.
	style = T.STYLE,
	layout = T.LAYOUT,
	thread = ns.Store:Thread(viewId),
}
local f = assert(io.open(outPath, "w"))
f:write(json(out))
f:close()
print("wrote " .. outPath .. ": " .. #out.elements .. " rows")
