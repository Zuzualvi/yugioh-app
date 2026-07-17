--王家の眠る谷－ネクロバレー (Pre-Errata)
--Necrovalley (Pre-Errata)
-- Edison override (RE-AUTHOR):
-- Correct Edison behavior: the 1st [Continuous] effect only negates effects that
-- explicitly CARD-TARGET the GY (EFFECT_FLAG_CARD_TARGET).
-- Non-targeting effects (Treeborn Frog revival, Rekindling, REDMD ignition) are NOT negated.
-- Previous script used GY-card EFFECT_NECRO_VALLEY presence to trigger negation, which
-- incorrectly caught non-targeting effects whose SetOperationInfo included a GY card.
-- Fix: s.disop early-returns when re lacks EFFECT_FLAG_CARD_TARGET.
local s,id=GetID()
function s.initial_effect(c)
	--Activate
	local e1=Effect.CreateEffect(c)
	e1:SetType(EFFECT_TYPE_ACTIVATE)
	e1:SetCode(EVENT_FREE_CHAIN)
	c:RegisterEffect(e1)
	--Increase ATK/DEF of Gravekeeper monsters by 500
	local e2=Effect.CreateEffect(c)
	e2:SetType(EFFECT_TYPE_FIELD)
	e2:SetCode(EFFECT_UPDATE_ATTACK)
	e2:SetRange(LOCATION_FZONE)
	e2:SetTargetRange(LOCATION_MZONE,LOCATION_MZONE)
	e2:SetTarget(aux.TargetBoolFunction(Card.IsSetCard,0x2e))
	e2:SetValue(500)
	c:RegisterEffect(e2)
	local e3=e2:Clone()
	e3:SetCode(EFFECT_UPDATE_DEFENSE)
	c:RegisterEffect(e3)
	--Cards in the GY cannot be banished (controller's GY)
	local e4=Effect.CreateEffect(c)
	e4:SetType(EFFECT_TYPE_FIELD)
	e4:SetCode(EFFECT_CANNOT_REMOVE)
	e4:SetRange(LOCATION_FZONE)
	e4:SetTargetRange(LOCATION_GRAVE,0)
	e4:SetCondition(s.contp)
	c:RegisterEffect(e4)
	--Cards in the GY cannot be banished (opponent's GY)
	local e5=e4:Clone()
	e5:SetTargetRange(0,LOCATION_GRAVE)
	e5:SetCondition(s.conntp)
	c:RegisterEffect(e5)
	--Mark GY cards with EFFECT_NECRO_VALLEY (controller)
	local e6=Effect.CreateEffect(c)
	e6:SetType(EFFECT_TYPE_FIELD)
	e6:SetCode(EFFECT_NECRO_VALLEY)
	e6:SetRange(LOCATION_FZONE)
	e6:SetTargetRange(LOCATION_GRAVE,0)
	e6:SetCondition(s.contp)
	e6:SetOperation(s.discon)
	c:RegisterEffect(e6)
	--Mark GY cards with EFFECT_NECRO_VALLEY (opponent)
	local e7=e6:Clone()
	e7:SetTargetRange(0,LOCATION_GRAVE)
	e7:SetCondition(s.conntp)
	c:RegisterEffect(e7)
	--Mark player with EFFECT_NECRO_VALLEY (controller)
	local e8=Effect.CreateEffect(c)
	e8:SetType(EFFECT_TYPE_FIELD)
	e8:SetCode(EFFECT_NECRO_VALLEY)
	e8:SetRange(LOCATION_FZONE)
	e8:SetProperty(EFFECT_FLAG_PLAYER_TARGET)
	e8:SetTargetRange(1,0)
	e8:SetCondition(s.contp)
	e8:SetOperation(s.discon)
	c:RegisterEffect(e8)
	--Mark player with EFFECT_NECRO_VALLEY (opponent)
	local e9=e8:Clone()
	e9:SetTargetRange(0,1)
	e9:SetCondition(s.conntp)
	c:RegisterEffect(e9)
	--Negate on resolution: ONLY effects that explicitly CARD-TARGET the GY.
	--Non-targeting effects (Treeborn Frog, Rekindling, REDMD ignition) are NOT negated.
	local e10=Effect.CreateEffect(c)
	e10:SetType(EFFECT_TYPE_FIELD+EFFECT_TYPE_CONTINUOUS)
	e10:SetCode(EVENT_CHAIN_SOLVING)
	e10:SetRange(LOCATION_FZONE)
	e10:SetOperation(s.disop)
	c:RegisterEffect(e10)
end
s.listed_series={0x2e}
function s.discon(e,c)
	return e:GetHandler()~=c
end
function s.contp(e)
	return not Duel.IsPlayerAffectedByEffect(e:GetHandler():GetControler(),EFFECT_NECRO_VALLEY_IM)
end
function s.conntp(e)
	return not Duel.IsPlayerAffectedByEffect(1-e:GetHandler():GetControler(),EFFECT_NECRO_VALLEY_IM)
end
function s.disfilter(c,im0,im1,re)
	if c:IsControler(0) then return im0 and c:IsHasEffect(EFFECT_NECRO_VALLEY) and c:IsRelateToEffect(re)
	else return im1 and c:IsHasEffect(EFFECT_NECRO_VALLEY) and c:IsRelateToEffect(re) end
end
function s.discheck(ev,category,re,im0,im1,targets)
	local ex,tg,ct,p,v=Duel.GetOperationInfo(ev,category)
	if not ex then return false end
	if tg and #tg>0 then
		if targets and targets:IsContains(re:GetHandler()) then
			return tg:IsExists(s.disfilter,1,nil,im0,im1,re)
		else
			return tg:IsExists(s.disfilter,1,re:GetHandler(),im0,im1,re)
		end
	end
	return false
end
function s.disop(e,tp,eg,ep,ev,re,r,rp)
	local tc=re:GetHandler()
	if not Duel.IsChainDisablable(ev) or tc:IsHasEffect(EFFECT_NECRO_VALLEY_IM) then return end
	--Edison ruling: only negate effects that explicitly CARD-TARGET the GY.
	--Non-targeting effects (Treeborn Frog revival, Rekindling, REDMD) are NOT negated.
	if not re:IsHasProperty(EFFECT_FLAG_CARD_TARGET) then return end
	local targets=Duel.GetChainInfo(ev,CHAININFO_TARGET_CARDS)
	local im0=not Duel.IsPlayerAffectedByEffect(0,EFFECT_NECRO_VALLEY_IM)
	local im1=not Duel.IsPlayerAffectedByEffect(1,EFFECT_NECRO_VALLEY_IM)
	local res=false
	if not res and s.discheck(ev,CATEGORY_SPECIAL_SUMMON,re,im0,im1,targets) then res=true end
	if not res and s.discheck(ev,CATEGORY_REMOVE,re,im0,im1,targets) then res=true end
	if not res and s.discheck(ev,CATEGORY_TOHAND,re,im0,im1,targets) then res=true end
	if not res and s.discheck(ev,CATEGORY_TODECK,re,im0,im1,targets) then res=true end
	if not res and s.discheck(ev,CATEGORY_TOEXTRA,re,im0,im1,targets) then res=true end
	if not res and s.discheck(ev,CATEGORY_LEAVE_GRAVE,re,im0,im1,targets) then res=true end
	if res then Duel.NegateEffect(ev) end
end
