--Z-Metal Tank — Edison override
-- Per Edison ruling (R03-B3): only the 6 listed unions provide destroy-instead
-- protection.  Z-Metal Tank is NOT listed → no destroy-substitute protection.
-- This override omits the EFFECT_DESTROY_SUBSTITUTE from AddUnionProcedure.
local s,id=GetID()
function s.initial_effect(c)
	local f=aux.FilterBoolFunction(Card.IsCode,62651957,65622692)
	--equip (new-style, no protection)
	local e1=Effect.CreateEffect(c)
	e1:SetDescription(1068)
	e1:SetCategory(CATEGORY_EQUIP)
	e1:SetProperty(EFFECT_FLAG_CARD_TARGET)
	e1:SetType(EFFECT_TYPE_IGNITION)
	e1:SetRange(LOCATION_MZONE)
	e1:SetTarget(aux.UnionTarget(f,false))
	e1:SetOperation(aux.UnionOperation(f))
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
	-- NO destroy-substitute effect — non-listed union, no protection per Edison ruling
	--eqlimit
	local e3=Effect.CreateEffect(c)
	e3:SetType(EFFECT_TYPE_SINGLE)
	e3:SetCode(EFFECT_UNION_LIMIT)
	e3:SetProperty(EFFECT_FLAG_CANNOT_DISABLE)
	e3:SetValue(aux.UnionLimit(f))
	c:RegisterEffect(e3)
	--ATK/DEF bonus
	local e4=Effect.CreateEffect(c)
	e4:SetType(EFFECT_TYPE_EQUIP)
	e4:SetCode(EFFECT_UPDATE_ATTACK)
	e4:SetValue(600)
	c:RegisterEffect(e4)
	local e5=e4:Clone()
	e5:SetCode(EFFECT_UPDATE_DEFENSE)
	c:RegisterEffect(e5)
end
s.listed_names={62651957,65622692}
