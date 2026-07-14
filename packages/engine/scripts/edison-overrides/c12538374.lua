--黄泉ガエル
--Treeborn Frog
-- Edison override (A13): Removed SetCountLimit(1) from e1.
-- Edison ruling: "If this card's effect/activation is negated, it can activate again in the same Phase."
-- Natural constraints prevent infinite re-trigger: once summoned, the card leaves the GY.
local s,id=GetID()
function s.initial_effect(c)
	--Special Summon
	local e1=Effect.CreateEffect(c)
	e1:SetDescription(aux.Stringid(id,0))
	e1:SetType(EFFECT_TYPE_TRIGGER_O+EFFECT_TYPE_FIELD)
	e1:SetCategory(CATEGORY_SPECIAL_SUMMON)
	e1:SetCode(EVENT_PHASE|PHASE_STANDBY)
	e1:SetRange(LOCATION_GRAVE)
	-- REMOVED: SetCountLimit(1) — allows re-activation after negation per Edison ruling
	e1:SetCondition(s.condition)
	e1:SetTarget(s.target)
	e1:SetOperation(s.operation)
	c:RegisterEffect(e1)
end
s.listed_names={id}
function s.filter(c)
	return c:IsSpellTrap() or (c:IsCode(id) and c:IsFaceup())
end
function s.condition(e,tp,eg,ep,ev,re,r,rp)
	return tp==Duel.GetTurnPlayer() and not Duel.IsExistingMatchingCard(s.filter,tp,LOCATION_ONFIELD,0,1,nil)
end
function s.target(e,tp,eg,ep,ev,re,r,rp,chk)
	if chk==0 then return Duel.GetLocationCount(tp,LOCATION_MZONE)>0
		and e:GetHandler():IsCanBeSpecialSummoned(e,0,tp,false,false) end
	Duel.SetOperationInfo(0,CATEGORY_SPECIAL_SUMMON,e:GetHandler(),1,0,0)
end
function s.operation(e,tp,eg,ep,ev,re,r,rp)
	if e:GetHandler():IsRelateToEffect(e) and not Duel.IsExistingMatchingCard(s.filter,tp,LOCATION_ONFIELD,0,1,nil) then
		Duel.SpecialSummon(e:GetHandler(),0,tp,tp,false,false,POS_FACEUP)
	end
end
