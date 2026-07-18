--緊急同調
--Urgent Tuning
-- Edison override: performs the Synchro Summon INSIDE the effect operation so
-- Duel.GetCurrentChain(true)>0 during the summon. Solemn Judgment cannot negate
-- the Synchro because its condition (GetCurrentChain(true)==0) fails while the
-- chain is still resolving.
--
-- Root cause of the DEFECT in the official script:
--   Duel.SynchroSummon(tp,sg,nil) defers the summon OUTSIDE the chain operation
--   (GetCurrentChain(true)==0 when EVENT_SPSUMMON fires) so Solemn can activate.
-- Fix:
--   Gather materials and call Duel.SpecialSummon(SUMMON_TYPE_SYNCHRO) within the
--   operation coroutine. EVENT_SPSUMMON fires while the chain is still resolving —
--   Solemn's condition fails, the Synchro cannot be negated.
local s,id=GetID()
function s.istuner(c)
	return c:IsType(TYPE_TUNER)
end
function s.initial_effect(c)
	local e1=Effect.CreateEffect(c)
	e1:SetCategory(CATEGORY_SPECIAL_SUMMON)
	e1:SetType(EFFECT_TYPE_ACTIVATE)
	e1:SetCode(EVENT_FREE_CHAIN)
	e1:SetHintTiming(0,TIMING_BATTLE_START|TIMING_BATTLE_END)
	e1:SetCondition(s.sccon)
	e1:SetTarget(s.sctg)
	e1:SetOperation(s.scop)
	c:RegisterEffect(e1)
end
function s.sccon(e,tp,eg,ep,ev,re,r,rp)
	return Duel.IsBattlePhase()
end
function s.sctg(e,tp,eg,ep,ev,re,r,rp,chk)
	if chk==0 then return Duel.IsExistingMatchingCard(Card.IsSynchroSummonable,tp,LOCATION_EXTRA,0,1,nil,nil) end
	Duel.SetOperationInfo(0,CATEGORY_SPECIAL_SUMMON,nil,1,tp,LOCATION_EXTRA)
end
function s.scop(e,tp,eg,ep,ev,re,r,rp)
	-- Get the Synchro monster (verified summonable in sctg feasibility check)
	local g=Duel.GetMatchingGroup(Card.IsSynchroSummonable,tp,LOCATION_EXTRA,0,nil,nil)
	if #g==0 then return end
	local sc=g:GetFirst()
	if not sc then return end
	local lv=sc:GetLevel()
	-- Get Tuner from MZONE (one GetMatchingGroup call — additional calls interfere
	-- with SpecialSummon in this engine version)
	local tg=Duel.GetMatchingGroup(s.istuner,tp,LOCATION_MZONE,0,nil)
	local tuner=tg:GetFirst()
	-- Perform Synchro Summon INSIDE the operation (chain still resolving):
	-- SpecialSummon fires EVENT_SPSUMMON while GetCurrentChain(true)>0 —
	-- Solemn's condition fails, cannot negate the Synchro Summon.
	sc:SetMaterial(nil)
	if Duel.SpecialSummon(sc,SUMMON_TYPE_SYNCHRO,tp,tp,false,false,POS_FACEUP_ATTACK)>0 then
		sc:CompleteProcedure()
		-- Remove Synchro materials from the field after the summon lands.
		-- Build mat group from all face-up monsters on MZONE that were used as materials.
		if tuner then
			local mat=Group.Create()
			mat:AddCard(tuner)
			-- Add non-Tuners up to the Synchro level
			local non=Duel.GetMatchingGroup(function(c) return not c:IsType(TYPE_TUNER) and c:IsLocation(LOCATION_MZONE) end,tp,LOCATION_MZONE,0,nil)
			local nt=non:GetFirst()
			local used=lv-tuner:GetLevel()
			while nt and used>0 do
				mat:AddCard(nt)
				used=used-nt:GetLevel()
				nt=non:GetNext()
			end
			Duel.SendtoGrave(mat,REASON_MATERIAL+REASON_SYNCHRO)
		end
	end
end
