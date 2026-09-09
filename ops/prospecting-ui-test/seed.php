<?php
declare(strict_types=1);

for ($attempt = 0; $attempt < 30; $attempt++) {
    try {
        $pdo = new PDO('mysql:host=db;dbname=prospecting_ui_test;charset=utf8mb4', 'root', 'fictional-local-test-only', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        break;
    } catch (Throwable) {
        usleep(100000);
    }
}
if (!isset($pdo)) throw new RuntimeException('Local fixture database did not become ready.');
foreach (['mysql-schema.sql', 'mysql-prospecting-v1.sql', 'mysql-prospecting-execution-v1.sql', 'mysql-prospecting-website-research-v1.sql', 'mysql-prospecting-website-research-requests-v1.sql'] as $migration) {
    $pdo->exec((string) file_get_contents('/app/database/' . $migration));
}

$pdo->beginTransaction();
try {
    $user = $pdo->prepare('insert into studio_users(email,password_hash,display_name) values(?,?,?)');
    $user->execute(['owner@example.test', password_hash('cinematic-flight-test-only', PASSWORD_DEFAULT), 'Local Prospecting Owner']);
    $ownerId = (int) $pdo->lastInsertId();
    $missionId = 'mission_11111111-1111-4111-8111-111111111111';
    $prospectId = 'prospect_22222222-2222-4222-8222-222222222222';
    $runId = 'agent-run_33333333-3333-4333-8333-333333333333';
    $qualificationId = 'qualification_44444444-4444-4444-8444-444444444444';

    $statement = $pdo->prepare("insert into prospecting_missions(public_id,owner_id,name,objective,location,target_categories_json,target_qualified_leads,minimum_score,mission_budget_centavos,status) values(?,?,?,?,?,?,?,?,?,'RUNNING')");
    $statement->execute([$missionId,$ownerId,'Tagaytay private stays','Review visually strong properties whose current sites may not communicate how the spaces connect.','Tagaytay',json_encode(['Private villa','Boutique resort']),5,75,25000]);
    $missionDbId = (int) $pdo->lastInsertId();

    $statement = $pdo->prepare("insert into prospecting_prospects(public_id,owner_id,business_name,category,address,location,website,phone,normalized_domain,status,contact_status) values(?,?,?,?,?,?,?,?,?,'PENDING_APPROVAL','FOUND')");
    $statement->execute([$prospectId,$ownerId,'Casa Verde Resort','Private villa','Fictional ridge road','Tagaytay','https://example.com','+63 900 000 0000','example.com']);
    $prospectDbId = (int) $pdo->lastInsertId();
    $pdo->prepare("insert into prospecting_mission_prospects(mission_id,prospect_id,discovery_source,mission_status,rank) values(?,?,'MANUAL','QUALIFIED',1)")->execute([$missionDbId,$prospectDbId]);

    $statement = $pdo->prepare("insert into prospecting_agent_runs(public_id,owner_id,mission_id,prospect_id,status,started_at,completed_at,stop_reason,step_count,llm_call_count,research_duration_ms) values(?,?,?,?, 'STOPPED',utc_timestamp(),utc_timestamp(),'HUMAN_APPROVAL_REQUIRED',2,0,1820)");
    $statement->execute([$runId,$ownerId,$missionDbId,$prospectDbId]);
    $runDbId = (int) $pdo->lastInsertId();

    $statement = $pdo->prepare("insert into prospecting_evidence(public_id,owner_id,prospect_id,agent_run_id,source_type,source_url,page_title,observation_type,claim,observation,content_hash,captured_at) values(?,?,?,?,?,?,?,?,?,?,?,utc_timestamp())");
    $observation = 'The inspected fixture page presents property spaces as separate static gallery images.';
    $statement->execute(['evidence_55555555-5555-4555-8555-555555555555',$ownerId,$prospectDbId,$runDbId,'WEBSITE','https://example.com/gallery','Gallery page','GALLERY_PRESENTATION','The inspected page supports a disconnected static-presentation finding.',$observation,hash('sha256',$observation)]);
    $pdo->prepare("insert into prospecting_contacts(public_id,owner_id,prospect_id,type,value,source_url,verification_status,is_primary) values(?,?,?,?,?,?,?,1)")->execute(['contact_66666666-6666-4666-8666-666666666666',$ownerId,$prospectDbId,'EMAIL','hello@example.com','https://example.com/contact','VERIFIED']);

    $statement = $pdo->prepare("insert into prospecting_qualifications(public_id,owner_id,prospect_id,version,experience_gap_score,walkthrough_fit_score,commercial_fit_score,visual_property_score,contactability_score,penalty_score,final_score,priority,qualification_status,confidence,experience_gap_summary,primary_marketing_problem,cinematicflight_opportunity,scoring_rule_version) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
    $statement->execute([$qualificationId,$ownerId,$prospectDbId,1,95,96,98,100,98,-20,77,'HIGH','QUALIFIED',0.83,'The stored pages present spaces individually instead of as one connected arrival.','Disconnected static property presentation','Create a connected visual journey from arrival through the major spaces.','cinematicflight-v1']);
    $qualificationDbId = (int) $pdo->lastInsertId();
    $artifact = $pdo->prepare("insert into prospecting_artifacts(public_id,owner_id,prospect_id,qualification_id,type,version,content) values(?,?,?,?,?,?,?)");
    $artifact->execute(['artifact_77777777-7777-4777-8777-777777777777',$ownerId,$prospectDbId,$qualificationDbId,'WALKTHROUGH_CONCEPT',1,json_encode(['format'=>'json','value'=>['scenes'=>['Arrival','Main gate','Villa','Pool','Garden']]])]);
    $artifact->execute(['artifact_88888888-8888-4888-8888-888888888888',$ownerId,$prospectDbId,$qualificationDbId,'OUTREACH_DRAFT',1,json_encode(['format'=>'text','value'=>'A private, evidence-supported outreach draft for owner review.'])]);

    $statement = $pdo->prepare("insert into prospecting_agent_decisions(public_id,owner_id,agent_run_id,step_number,action,reason,target,expected_information,authority_result,budget_result,estimated_cost_centavos,actual_cost_centavos,confidence,state_before_json,state_after_json,governance_trace_json) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
    $statement->execute(['decision_99999999-9999-4999-8999-999999999999',$ownerId,$runDbId,1,'INSPECT_PAGE','Need first-party evidence about the stored gallery presentation.','https://example.com/gallery','Observed presentation structure','ALLOWED','ALLOW_FREE',0,0,0.83,json_encode(['status'=>'RESEARCHING']),json_encode(['evidence_version'=>1]),json_encode(['final'=>['result'=>'ALLOW'],'authority'=>['result'=>'ALLOWED'],'budget'=>['result'=>'ALLOW_FREE']])]);
    $pdo->prepare("insert into prospecting_cost_events(public_id,owner_id,mission_id,prospect_id,agent_run_id,provider,operation,estimated_cost_centavos,actual_cost_centavos,idempotency_key) values(?,?,?,?,?,?,?,?,?,?)")->execute(['cost-event_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',$ownerId,$missionDbId,$prospectDbId,$runDbId,'local-fixture','page-inspection',150,125,'local-preview-cost-0001']);
    $pdo->prepare("insert into prospecting_budget_reservations(public_id,owner_id,mission_id,prospect_id,agent_run_id,provider,operation,estimated_cost_centavos,reserved_cost_centavos,status,idempotency_key,request_hash,expires_at) values(?,?,?,?,?,?,?,?,?,'RESERVED',?,?,utc_timestamp()+interval 1 hour)")->execute(['reservation_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',$ownerId,$missionDbId,$prospectDbId,$runDbId,'local-fixture','contact-check',75,75,'local-preview-reservation-0001',str_repeat('b',64)]);
    $pdo->commit();
} catch (Throwable $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    throw $error;
}

echo "Local Prospecting fixture ready. No external requests were made.\n";
