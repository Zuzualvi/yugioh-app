--エンシェント・フェアリー・ドラゴン (Pre-Errata)
--Ancient Fairy Dragon (Pre-Errata)
-- Edison override (A1): (1) Removed PHASE_MAIN1 condition from e1 so SSummon works in MP1+MP2.
-- (2) e2 does NOT target (removed EFFECT_FLAG_CARD_TARGET); selection of ONE field spell happens
--     at resolution (non-targeting). If destroy fails, no LP gain and no add-field.
-- Implementation note: e2 is registered BEFORE e1 so it is the primary activatable ignition
-- entry when a field spell is present.
-- Edison-era note: field spells reside in LOCATION_SZONE (seq 5), not LOCATION_FZONE.
local s,id=GetID()
function s.initial_effect(c)
	c:EnableReviveLimit()
	--Synchro Summon procedure
	Synchro.AddProcedure(c,nil,1,1,Synchro.NonTuner(nil),1,99)
	--Destroy a Field Spell Card (player selects one at resolution) and gain LP
	-- Registered FIRST: becomes the primary activatable ignition when a field spell is present.
	local e2=Effect.CreateEffect(c)
	e2:SetDescription(aux.Stringid(id,1))
	e2:SetCategory(CATEGORY_DESTROY+CATEGORY_RECOVER+CATEGORY_TOHAND+CATEGORY_SEARCH)
	e2:SetType(EFFECT_TYPE_IGNITION)
	-- REMOVED: EFFECT_FLAG_CARD_TARGET (Edison text has no "target" keyword; selection at resolution)
	e2:SetRange(LOCATION_MZONE)
	e2:SetCountLimit(1)
	e2:SetTarget(s.destg)
	e2:SetOperation(s.desop)
	c:RegisterEffect(e2)
	--Special Summon 1 Level 4 or lower monster from your hand
	local e1=Effect.CreateEffect(c)
	e1:SetDescription(aux.Stringid(id,0))
	e1:SetCategory(CATEGORY_SPECIAL_SUMMON)
	e1:SetType(EFFECT_TYPE_IGNITION)
	e1:SetRange(LOCATION_MZONE)
	e1:SetCountLimit(1)
	-- REMOVED: SetCondition restricting to PHASE_MAIN1; ignition effects are naturally Main-Phase only
	e1:SetCost(s.spcost)
	e1:SetTarget(s.sptg)
	e1:SetOperation(s.spop)
	c:RegisterEffect(e1)
end
function s.spcost(e,tp,eg,ep,ev,re,r,rp,chk)
	if chk==0 then return true end
	--Cannot conduct your Battle Phase this turn
	local e1=Effect.CreateEffect(e:GetHandler())
	e1:SetDescription(aux.Stringid(id,2))
	e1:SetType(EFFECT_TYPE_FIELD)
	e1:SetProperty(EFFECT_FLAG_PLAYER_TARGET+EFFECT_FLAG_OATH+EFFECT_FLAG_CLIENT_HINT)
	e1:SetCode(EFFECT_CANNOT_BP)
	e1:SetTargetRange(1,0)
	e1:SetReset(RESET_PHASE+PHASE_END)
	Duel.RegisterEffect(e1,tp)
end
function s.spfilter(c,e,tp)
	return c:IsLevelBelow(4) and c:IsCanBeSpecialSummoned(e,0,tp,false,false)
end
function s.sptg(e,tp,eg,ep,ev,re,r,rp,chk)
	if chk==0 then return Duel.GetLocationCount(tp,LOCATION_MZONE)>0
		and Duel.IsExistingMatchingCard(s.spfilter,tp,LOCATION_HAND,0,1,nil,e,tp) end
	Duel.Hint(HINT_OPSELECTED,1-tp,e:GetDescription())
	Duel.SetOperationInfo(0,CATEGORY_SPECIAL_SUMMON,nil,1,tp,LOCATION_HAND)
end
function s.spop(e,tp,eg,ep,ev,re,r,rp)
	if Duel.GetLocationCount(tp,LOCATION_MZONE)<=0 then return end
	Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_SPSUMMON)
	local g=Duel.SelectMatchingCard(tp,s.spfilter,tp,LOCATION_HAND,0,1,1,nil,e,tp)
	if #g>0 then
		Duel.SpecialSummon(g,0,tp,tp,false,false,POS_FACEUP)
	end
end
-- Edison A1 (e2): check for field spells in SZONE (where they reside in Edison/MR1 format)
function s.destg(e,tp,eg,ep,ev,re,r,rp,chk)
	if chk==0 then
		-- In Edison-era, field spells are at LOCATION_SZONE seq 5; check both players' SZONEs
		return Duel.IsExistingMatchingCard(Card.IsFieldSpell,tp,LOCATION_SZONE,LOCATION_SZONE,1,nil)
	end
	-- No target declared here; selection happens on resolution
	Duel.SetOperationInfo(0,CATEGORY_DESTROY,nil,1,0,0)
	Duel.SetOperationInfo(0,CATEGORY_RECOVER,nil,0,tp,1000)
	Duel.SetPossibleOperationInfo(0,CATEGORY_TOHAND,nil,1,tp,LOCATION_DECK)
end
function s.thfilter(c)
	return c:IsFieldSpell() and c:IsAbleToHand()
end
-- Edison A1 (e2): select ONE field spell at resolution; if destroy fails, no LP/no add
function s.desop(e,tp,eg,ep,ev,re,r,rp)
	if not Duel.IsExistingMatchingCard(Card.IsFieldSpell,tp,LOCATION_SZONE,LOCATION_SZONE,1,nil) then return end
	Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_DESTROY)
	local g=Duel.SelectMatchingCard(tp,Card.IsFieldSpell,tp,LOCATION_SZONE,LOCATION_SZONE,1,1,nil)
	if #g==0 then return end
	local tc=g:GetFirst()
	if Duel.Destroy(tc,REASON_EFFECT)==0 then return end
	Duel.Recover(tp,1000,REASON_EFFECT)
	local hg=Duel.GetMatchingGroup(s.thfilter,tp,LOCATION_DECK,0,nil)
	if #hg>0 and Duel.SelectYesNo(tp,aux.Stringid(id,3)) then
		Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_ATOHAND)
		local sg=hg:Select(tp,1,1,nil)
		Duel.BreakEffect()
		Duel.SendtoHand(sg,nil,REASON_EFFECT)
		Duel.ConfirmCards(1-tp,sg)
	end
end
