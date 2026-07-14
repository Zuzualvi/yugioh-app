--光と闇の竜
--Light and Darkness Dragon
-- Edison override (A6):
-- (1) Removed EFFECT_COUNT_CODE_CHAIN from e2 SetCountLimit — LaDD can negate every activation in a chain.
-- (2) Removed EFFECT_FLAG_CARD_TARGET from e3 — GY monster selected at resolution (non-targeting).
local s,id=GetID()
function s.initial_effect(c)
	c:AddCannotBeSpecialSummoned()
	--While face-up on the field, this card is also DARK-Attribute
	local e1=Effect.CreateEffect(c)
	e1:SetType(EFFECT_TYPE_SINGLE)
	e1:SetProperty(EFFECT_FLAG_SINGLE_RANGE)
	e1:SetCode(EFFECT_ADD_ATTRIBUTE)
	e1:SetRange(LOCATION_MZONE)
	e1:SetValue(ATTRIBUTE_DARK)
	c:RegisterEffect(e1)
	--Negate each activation (no once-per-chain limit in Edison)
	local e2=Effect.CreateEffect(c)
	e2:SetDescription(aux.Stringid(id,0))
	e2:SetCategory(CATEGORY_NEGATE+CATEGORY_ATKCHANGE+CATEGORY_DEFCHANGE)
	e2:SetType(EFFECT_TYPE_QUICK_F)
	e2:SetProperty(EFFECT_FLAG_DAMAGE_STEP+EFFECT_FLAG_DAMAGE_CAL)
	e2:SetCode(EVENT_CHAINING)
	e2:SetRange(LOCATION_MZONE)
	-- REMOVED: SetCountLimit(1,0,EFFECT_COUNT_CODE_CHAIN) — Edison LaDD negates every activation
	e2:SetCondition(function(e,tp,eg,ep,ev,re,r,rp) return re:IsHasType(EFFECT_TYPE_ACTIVATE) or re:IsMonsterEffect() end)
	e2:SetTarget(s.negtg)
	e2:SetOperation(s.negop)
	c:RegisterEffect(e2)
	--Destroy all cards you control and Special Summon 1 monster from your GY (non-targeting in Edison)
	local e3=Effect.CreateEffect(c)
	e3:SetDescription(aux.Stringid(id,1))
	e3:SetCategory(CATEGORY_DESTROY+CATEGORY_SPECIAL_SUMMON)
	e3:SetType(EFFECT_TYPE_SINGLE+EFFECT_TYPE_TRIGGER_F)
	-- REMOVED: EFFECT_FLAG_CARD_TARGET — GY monster chosen at resolution
	e3:SetCode(EVENT_TO_GRAVE)
	e3:SetCondition(function(e) return e:GetHandler():IsReason(REASON_DESTROY) end)
	e3:SetTarget(s.sptg)
	e3:SetOperation(s.spop)
	c:RegisterEffect(e3)
	--"Double Snare" validity
	aux.DoubleSnareValidity(c,LOCATION_MZONE)
end
function s.negtg(e,tp,eg,ep,ev,re,r,rp,chk)
	local c=e:GetHandler()
	if chk==0 then return not c:HasFlagEffect(id) end
	if c:IsHasEffect(EFFECT_REVERSE_UPDATE) then
		c:RegisterFlagEffect(id,RESETS_STANDARD_PHASE_END,0,1)
	end
	Duel.SetOperationInfo(0,CATEGORY_NEGATE,eg,1,tp,0)
end
function s.negop(e,tp,eg,ep,ev,re,r,rp)
	local c=e:GetHandler()
	if c:IsFaceup() and c:IsRelateToEffect(e) and c:IsAttackAbove(500) and c:IsDefenseAbove(500)
		and not c:IsStatus(STATUS_BATTLE_DESTROYED) and Duel.GetCurrentChain()==ev+1
		and Duel.NegateActivation(ev) then
		local e1=Effect.CreateEffect(c)
		e1:SetType(EFFECT_TYPE_SINGLE)
		e1:SetProperty(EFFECT_FLAG_COPY_INHERIT)
		e1:SetCode(EFFECT_UPDATE_ATTACK)
		e1:SetValue(-500)
		e1:SetReset(RESET_EVENT|RESETS_STANDARD_DISABLE)
		c:RegisterEffect(e1)
		local e2=e1:Clone()
		e2:SetCode(EFFECT_UPDATE_DEFENSE)
		c:RegisterEffect(e2)
	end
end
-- Feasibility target; GY monster chosen in operation (non-targeting)
function s.sptg(e,tp,eg,ep,ev,re,r,rp,chk)
	if chk==0 then return true end
	local dg=Duel.GetFieldGroup(tp,LOCATION_ONFIELD,0)
	Duel.SetOperationInfo(0,CATEGORY_DESTROY,dg,#dg,tp,0)
	Duel.SetOperationInfo(0,CATEGORY_SPECIAL_SUMMON,nil,1,tp,LOCATION_GRAVE)
end
function s.spop(e,tp,eg,ep,ev,re,r,rp)
	local g=Duel.GetFieldGroup(tp,LOCATION_ONFIELD,0)
	if #g>0 then
		Duel.Destroy(g,REASON_EFFECT)
	end
	-- Select from GY at resolution (non-targeting)
	Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_SPSUMMON)
	local sg=Duel.SelectMatchingCard(tp,Card.IsCanBeSpecialSummoned,tp,LOCATION_GRAVE,0,1,1,nil,e,0,tp,false,false)
	if #sg>0 then
		Duel.BreakEffect()
		Duel.SpecialSummon(sg,0,tp,tp,false,false,POS_FACEUP)
	end
end
