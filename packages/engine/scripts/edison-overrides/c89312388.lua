--E・HERO プリズマー
--Elemental HERO Prisma
-- Edison override (A4): Edison ruling "This effect has no cost."
-- Removed SetCost(coscost); reveal and send moved to operation (resolution).
-- Cost function is feasibility-only (checks but does not send).
local s,id=GetID()
function s.initial_effect(c)
	local e1=Effect.CreateEffect(c)
	e1:SetDescription(aux.Stringid(id,0))
	e1:SetType(EFFECT_TYPE_IGNITION)
	e1:SetCountLimit(1)
	e1:SetRange(LOCATION_MZONE)
	-- CHANGED: SetCost now only checks feasibility; actual reveal+send happens in operation
	e1:SetCost(s.coscost)
	e1:SetOperation(s.cosoperation)
	c:RegisterEffect(e1)
end
function s.filter2(c,fc)
	if not c:IsAbleToGrave() then return false end
	return c:IsCode(table.unpack(fc.material))
end
function s.filter1(c,tp)
	return c.material and c:IsType(TYPE_FUSION) and Duel.IsExistingMatchingCard(s.filter2,tp,LOCATION_DECK,0,1,nil,c)
end
-- Feasibility check only; no cards are sent here (Edison: no cost)
function s.coscost(e,tp,eg,ep,ev,re,r,rp,chk)
	if chk==0 then return Duel.IsExistingMatchingCard(s.filter1,tp,LOCATION_EXTRA,0,1,nil,tp) end
	-- No action: send happens on resolution, not at activation
end
-- On resolution: reveal fusion monster, send material, apply name change
function s.cosoperation(e,tp,eg,ep,ev,re,r,rp)
	local c=e:GetHandler()
	if not c:IsRelateToEffect(e) or c:IsFacedown() then return end
	if not Duel.IsExistingMatchingCard(s.filter1,tp,LOCATION_EXTRA,0,1,nil,tp) then return end
	Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_CONFIRM)
	local g=Duel.SelectMatchingCard(tp,s.filter1,tp,LOCATION_EXTRA,0,1,1,nil,tp)
	if #g==0 then return end
	Duel.ConfirmCards(1-tp,g)
	local fc=g:GetFirst()
	if not Duel.IsExistingMatchingCard(s.filter2,tp,LOCATION_DECK,0,1,nil,fc) then return end
	Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_TOGRAVE)
	local cg=Duel.SelectMatchingCard(tp,s.filter2,tp,LOCATION_DECK,0,1,1,nil,fc)
	if #cg==0 then return end
	Duel.SendtoGrave(cg,REASON_EFFECT)
	local code=cg:GetFirst():GetCode()
	local e1=Effect.CreateEffect(c)
	e1:SetType(EFFECT_TYPE_SINGLE)
	e1:SetCode(EFFECT_CHANGE_CODE)
	e1:SetProperty(EFFECT_FLAG_CANNOT_DISABLE)
	e1:SetReset(RESETS_STANDARD_PHASE_END)
	e1:SetValue(code)
	c:RegisterEffect(e1)
end
