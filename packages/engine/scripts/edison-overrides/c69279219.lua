--我が身を盾に
--My Body as a Shield
-- Edison override: EFFECT_FLAG_DAMAGE_STEP is kept (it allows activation from HAND
-- as a fast effect during the opponent's chain window, which is required for Edison
-- behaviour — Quick-Play Spells cannot chain from HAND without this flag in GOAT mode).
-- Edison ruling "cannot activate in the Damage Step" is enforced via an explicit
-- Duel.IsDamageStep() guard in the condition instead of removing the flag.
-- Without the flag My Body is never offered in opponent's Main Phase chain windows,
-- which breaks R05-B6b (Lightning Vortex) and R05-B6c (Raigeki Break).
local s,id=GetID()
function s.initial_effect(c)
	--Negate
	local e1=Effect.CreateEffect(c)
	e1:SetCategory(CATEGORY_NEGATE+CATEGORY_DESTROY)
	e1:SetProperty(EFFECT_FLAG_DAMAGE_STEP+EFFECT_FLAG_DAMAGE_CAL)
	e1:SetType(EFFECT_TYPE_ACTIVATE)
	e1:SetCode(EVENT_CHAINING)
	e1:SetCondition(s.condition)
	e1:SetCost(Cost.PayLP(1500))
	e1:SetTarget(s.target)
	e1:SetOperation(s.operation)
	c:RegisterEffect(e1)
end
function s.cfilter(c)
	return c:IsOnField() and c:IsMonster()
end
function s.condition(e,tp,eg,ep,ev,re,r,rp)
	-- Edison ruling: My Body as a Shield CANNOT activate in the Damage Step.
	if Duel.IsDamageStep() then return false end
	if tp==ep or not Duel.IsChainNegatable(ev) then return false end
	if not re:IsMonsterEffect() and not re:IsHasType(EFFECT_TYPE_ACTIVATE) then return false end
	local ex,tg,tc=Duel.GetOperationInfo(ev,CATEGORY_DESTROY)
	return ex and tg~=nil and tc+tg:FilterCount(s.cfilter,nil)-#tg>0
end
function s.target(e,tp,eg,ep,ev,re,r,rp,chk)
	if chk==0 then return true end
	Duel.SetOperationInfo(0,CATEGORY_NEGATE,eg,1,0,0)
	if re:GetHandler():IsDestructable() and re:GetHandler():IsRelateToEffect(re) then
		Duel.SetOperationInfo(0,CATEGORY_DESTROY,eg,1,0,0)
	end
end
function s.operation(e,tp,eg,ep,ev,re,r,rp)
	if Duel.NegateActivation(ev) and re:GetHandler():IsRelateToEffect(re) then
		Duel.Destroy(eg,REASON_EFFECT)
	end
end
