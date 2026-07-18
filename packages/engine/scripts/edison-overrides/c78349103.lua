--Machina Peacekeeper — Edison override
-- Fix (R03-B1): enforce the 1-union-per-monster limit.
-- The engine's Card:GetUnionCount() ct2 does not reliably reflect equip state
-- after Duel.Equip in this WASM version, so we check Card:GetEquipGroup() for
-- any card with EFFECT_UNION_STATUS (new-style union) to block a 2nd equip.
local s,id=GetID()

local MACH_FILTER=aux.FilterBoolFunction(Card.IsRace,RACE_MACHINE)

-- Returns true if tc has NO new-style (non-old) union currently equipped.
local function has_no_new_union(tc)
	local eq=tc:GetEquipGroup()
	for i=1,#eq do
		if eq[i]:IsHasEffect(EFFECT_UNION_STATUS) and not eq[i]:IsHasEffect(EFFECT_OLDUNION_STATUS) then
			return false
		end
	end
	return true
end

-- Filter: target must be face-up Machine with no new-style union already equipped.
-- Extra arg mf is the Machine filter (passed via IsExistingTarget/SelectTarget).
local function equip_filter(tc,mf)
	return tc:IsFaceup() and mf(tc) and has_no_new_union(tc)
end

function s.initial_effect(c)
	--equip (custom target to enforce union limit)
	local e1=Effect.CreateEffect(c)
	e1:SetDescription(1068)
	e1:SetCategory(CATEGORY_EQUIP)
	e1:SetProperty(EFFECT_FLAG_CARD_TARGET)
	e1:SetType(EFFECT_TYPE_IGNITION)
	e1:SetRange(LOCATION_MZONE)
	e1:SetTarget(function(e,tp,eg,ep,ev,re,r,rp,chk,chkc)
		local u=e:GetHandler()
		local code=u:GetOriginalCode()
		if chkc then
			return chkc:IsLocation(LOCATION_MZONE) and chkc:IsControler(tp)
				and equip_filter(chkc,MACH_FILTER)
		end
		if chk==0 then
			return u:GetFlagEffect(code)==0
				and Duel.GetLocationCount(tp,LOCATION_SZONE)>0
				and Duel.IsExistingTarget(equip_filter,tp,LOCATION_MZONE,0,1,u,MACH_FILTER)
		end
		Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_EQUIP)
		local g=Duel.SelectTarget(tp,equip_filter,tp,LOCATION_MZONE,0,1,1,u,MACH_FILTER)
		Duel.SetOperationInfo(0,CATEGORY_EQUIP,g,1,0,0)
		u:RegisterFlagEffect(code,RESET_EVENT+(RESETS_STANDARD-RESET_TOFIELD-RESET_LEAVE)+RESET_PHASE+PHASE_END,0,1)
	end)
	e1:SetOperation(aux.UnionOperation(MACH_FILTER))
	c:RegisterEffect(e1)
	--unequip
	local e2=Effect.CreateEffect(c)
	e2:SetDescription(2)
	e2:SetCategory(CATEGORY_SPECIAL_SUMMON)
	e2:SetType(EFFECT_TYPE_IGNITION)
	e2:SetRange(LOCATION_SZONE)
	e2:SetCondition(function(e) return e:GetHandler():GetEquipTarget() end)
	e2:SetTarget(aux.UnionSumTarget(false))
	e2:SetOperation(aux.UnionSumOperation(false))
	c:RegisterEffect(e2)
	--destroy-substitute (Peacekeeper IS a listed union — full protection)
	local e3=Effect.CreateEffect(c)
	e3:SetType(EFFECT_TYPE_EQUIP)
	e3:SetProperty(EFFECT_FLAG_IGNORE_IMMUNE)
	e3:SetCode(EFFECT_DESTROY_SUBSTITUTE)
	e3:SetCondition(function(e) return e:GetHandler():GetEquipTarget() end)
	e3:SetValue(function(_e,_re,r,_rp)
		return (r&REASON_BATTLE)~=0 or (r&REASON_EFFECT)~=0
	end)
	c:RegisterEffect(e3)
	--eqlimit
	local e4=Effect.CreateEffect(c)
	e4:SetType(EFFECT_TYPE_SINGLE)
	e4:SetCode(EFFECT_UNION_LIMIT)
	e4:SetProperty(EFFECT_FLAG_CANNOT_DISABLE)
	e4:SetValue(aux.UnionLimit(MACH_FILTER))
	c:RegisterEffect(e4)
	--GY search (from destruction while equipped on field)
	local e5=Effect.CreateEffect(c)
	e5:SetDescription(aux.Stringid(id,2))
	e5:SetCategory(CATEGORY_TOHAND+CATEGORY_SEARCH)
	e5:SetType(EFFECT_TYPE_TRIGGER_O+EFFECT_TYPE_SINGLE)
	e5:SetProperty(EFFECT_FLAG_DAMAGE_STEP)
	e5:SetCode(EVENT_TO_GRAVE)
	e5:SetCondition(s.scon)
	e5:SetTarget(s.stg)
	e5:SetOperation(s.sop)
	c:RegisterEffect(e5)
end
function s.sfilter(c)
	return c:IsType(TYPE_UNION) and c:IsAbleToHand()
end
function s.scon(e,tp,eg,ep,ev,re,r,rp)
	return e:GetHandler():IsPreviousLocation(LOCATION_ONFIELD) and e:GetHandler():IsReason(REASON_DESTROY)
end
function s.stg(e,tp,eg,ep,ev,re,r,rp,chk)
	if chk==0 then return Duel.IsExistingMatchingCard(s.sfilter,tp,LOCATION_DECK,0,1,nil) end
	Duel.SetOperationInfo(0,CATEGORY_TOHAND,nil,1,tp,LOCATION_DECK)
end
function s.sop(e,tp,eg,ep,ev,re,r,rp)
	Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_ATOHAND)
	local g=Duel.SelectMatchingCard(tp,s.sfilter,tp,LOCATION_DECK,0,1,1,nil)
	if #g>0 then
		Duel.SendtoHand(g,nil,REASON_EFFECT)
		Duel.ConfirmCards(1-tp,g)
	end
end
