<?php
declare(strict_types=1);

// Dedicated server-to-server mutation boundary. The browser/session API can only
// read execution records. This file performs no tools, crawling, LLM, or outreach.

const PROSPECTING_RUN_STATUSES = ['PENDING','RUNNING','COMPLETED','STOPPED','FAILED'];
const PROSPECTING_RUN_STOP_REASONS = ['QUALIFIED','DISQUALIFIED','INSUFFICIENT_EVIDENCE','BUDGET_LIMIT','STEP_LIMIT','PAGE_LIMIT','LLM_LIMIT','TIME_LIMIT','TOOL_LIMIT','REPEATED_ACTION','DUPLICATE','HUMAN_APPROVAL_REQUIRED','TOOL_FAILURE','FAILED'];
const PROSPECTING_AGENT_ACTIONS = ['DISCOVER_MORE','INSPECT_WEBSITE','INSPECT_PAGE','DETECT_EXISTING_EXPERIENCE','FIND_CONTACT','ANALYZE_EXPERIENCE_GAP','CALCULATE_SCORE','GENERATE_WALKTHROUGH','DRAFT_OUTREACH','SAVE_EVIDENCE','SAVE_PROSPECT','QUALIFY','DISQUALIFY','REQUEST_APPROVAL','STOP_INSUFFICIENT_EVIDENCE','STOP_BUDGET_LIMIT','STOP_TOOL_LIMIT','STOP_REPEATED_ACTION','STOP_DUPLICATE'];
const PROSPECTING_AUTHORITY_RESULTS = ['ALLOWED','DENIED','HUMAN_APPROVAL_REQUIRED','NOT_EVALUATED'];
const PROSPECTING_BUDGET_RESULTS = ['ALLOWED','ALLOW_FREE','DENIED','NOT_APPLICABLE','NOT_EVALUATED'];
const PROSPECTING_ARTIFACT_TYPES = ['WALKTHROUGH_CONCEPT','OUTREACH_DRAFT'];
const PROSPECTING_RESERVATION_STATUSES = ['RESERVED','COMMITTED','RELEASED','EXPIRED','RECONCILIATION_REQUIRED'];

function prospecting_agent_authenticate(array $config): int
{
    if (($config['prospecting_agent_ingest_enabled'] ?? false) !== true) throw new ProspectingError('Prospecting agent ingest is disabled.', 503);
    $authorization=(string)($_SERVER['HTTP_AUTHORIZATION']??'');
    if(!preg_match('/^Bearer ([0-9a-f]{64})$/D',$authorization,$match))throw new ProspectingError('Agent authentication failed.',403);
    $provided=$match[1];
    $current=$config['prospecting_agent_tokens']??[];$previous=$config['prospecting_agent_previous_tokens']??[];
    if(!is_array($current)||!is_array($previous))throw new ProspectingError('Agent authentication is not configured.',503);
    foreach([$current,$previous] as $tokenSet){
        foreach($tokenSet as $owner=>$token){
            if(!is_int($owner)&&!ctype_digit((string)$owner))continue;
            if(is_string($token)&&preg_match('/^[0-9a-f]{64}$/D',$token)&&hash_equals($token,$provided))return (int)$owner;
        }
    }
    throw new ProspectingError('Agent authentication failed.',403);
}

function prospecting_agent_run_row(array $row):array
{
    return ['public_id'=>$row['public_id'],'mission_id'=>$row['mission_public_id']??null,'prospect_id'=>$row['prospect_public_id']??null,'status'=>$row['status'],'started_at'=>$row['started_at'],'completed_at'=>$row['completed_at'],'stop_reason'=>$row['stop_reason'],'step_count'=>(int)$row['step_count'],'llm_call_count'=>(int)$row['llm_call_count'],'research_duration_ms'=>(int)$row['research_duration_ms'],'created_at'=>$row['created_at'],'updated_at'=>$row['updated_at']];
}

function prospecting_agent_fetch_run(PDO $pdo,int $ownerId,string $publicId,bool $lock=false):array
{
    $query=$pdo->prepare('select r.*,m.public_id mission_public_id,p.public_id prospect_public_id from prospecting_agent_runs r left join prospecting_missions m on m.id=r.mission_id and m.owner_id=r.owner_id join prospecting_prospects p on p.id=r.prospect_id and p.owner_id=r.owner_id where r.owner_id=? and r.public_id=?'.($lock?' for update':''));
    $query->execute([$ownerId,$publicId]);$row=$query->fetch();if(!$row)throw new ProspectingError('The agent run could not be found.',404);return $row;
}

function prospecting_agent_create_run(PDO $pdo,int $ownerId,array $body):array
{
    prospecting_reject_unknown($body,['mission_public_id','prospect_public_id','status']);
    $prospectPublic=prospecting_text($body,'prospect_public_id',80);$prospect=prospecting_find($pdo,'prospecting_prospects',$ownerId,$prospectPublic,true);
    $missionPublic=prospecting_text($body,'mission_public_id',80);$mission=prospecting_find($pdo,'prospecting_missions',$ownerId,$missionPublic,true);$missionId=(int)$mission['id'];
    $membership=$pdo->prepare('select 1 from prospecting_mission_prospects where mission_id=? and prospect_id=?');$membership->execute([$missionId,$prospect['id']]);
    if(!$membership->fetchColumn())throw new ProspectingError('The prospect is not a member of this mission.',422);
    $status=prospecting_enum($body,'status',['PENDING','RUNNING'],false)??'PENDING';$publicId=prospecting_public_id('agent-run');
    $statement=$pdo->prepare('insert into prospecting_agent_runs(public_id,owner_id,mission_id,prospect_id,status,started_at) values(?,?,?,?,?,?)');
    $statement->execute([$publicId,$ownerId,$missionId,$prospect['id'],$status,$status==='RUNNING'?gmdate('Y-m-d H:i:s'):null]);
    return prospecting_agent_run_row(prospecting_agent_fetch_run($pdo,$ownerId,$publicId));
}

function prospecting_agent_update_run(PDO $pdo,int $ownerId,array $body):array
{
    prospecting_reject_unknown($body,['run_public_id','status','step_count','llm_call_count','research_duration_ms','stop_reason']);
    $publicId=prospecting_text($body,'run_public_id',80);$row=prospecting_agent_fetch_run($pdo,$ownerId,$publicId,true);
    if(in_array($row['status'],['COMPLETED','STOPPED','FAILED'],true))throw new ProspectingError('Completed agent runs are immutable.',409);
    $status=prospecting_enum($body,'status',PROSPECTING_RUN_STATUSES,false)??$row['status'];
    $transitions=['PENDING'=>['PENDING','RUNNING','STOPPED','FAILED'],'RUNNING'=>['RUNNING','COMPLETED','STOPPED','FAILED']];
    if(!in_array($status,$transitions[$row['status']]??[],true))throw new ProspectingError('Invalid agent run status transition.',409);
    $step=prospecting_integer($body,'step_count',0,null,false)??(int)$row['step_count'];
    $llm=prospecting_integer($body,'llm_call_count',0,null,false)??(int)$row['llm_call_count'];
    $duration=prospecting_integer($body,'research_duration_ms',0,null,false)??(int)$row['research_duration_ms'];
    if($step<(int)$row['step_count']||$llm<(int)$row['llm_call_count']||$duration<(int)$row['research_duration_ms'])throw new ProspectingError('Agent run counters cannot decrease.',409);
    $stop=prospecting_enum($body,'stop_reason',PROSPECTING_RUN_STOP_REASONS,false);
    $terminal=in_array($status,['COMPLETED','STOPPED','FAILED'],true);
    if($terminal&&$stop===null)throw new ProspectingError('A terminal agent run requires a valid stop_reason.',422);
    if(!$terminal&&$stop!==null)throw new ProspectingError('A running agent run cannot have a stop_reason.',422);
    $started=$row['started_at'];if($status==='RUNNING'&&$started===null)$started=gmdate('Y-m-d H:i:s');
    $completed=$terminal?gmdate('Y-m-d H:i:s'):null;
    $statement=$pdo->prepare('update prospecting_agent_runs set status=?,started_at=?,completed_at=?,stop_reason=?,step_count=?,llm_call_count=?,research_duration_ms=? where owner_id=? and id=?');
    $statement->execute([$status,$started,$completed,$stop,$step,$llm,$duration,$ownerId,$row['id']]);
    return prospecting_agent_run_row(prospecting_agent_fetch_run($pdo,$ownerId,$publicId));
}

function prospecting_agent_append_decision(PDO $pdo,int $ownerId,array $body):array
{
    prospecting_reject_unknown($body,['run_public_id','step_number','action','reason','target','expected_information','authority_result','budget_result','estimated_cost_centavos','actual_cost_centavos','confidence','state_before','state_after','governance_trace']);
    $runPublic=prospecting_text($body,'run_public_id',80);$run=prospecting_agent_fetch_run($pdo,$ownerId,$runPublic,true);
    if(in_array($run['status'],['COMPLETED','STOPPED','FAILED'],true))throw new ProspectingError('Decisions cannot be appended to a completed run.',409);
    $step=prospecting_integer($body,'step_number',1);$action=prospecting_enum($body,'action',PROSPECTING_AGENT_ACTIONS);
    $reason=prospecting_text($body,'reason',5000);$target=prospecting_text($body,'target',2048,false);$expected=prospecting_text($body,'expected_information',5000,false);
    $authority=prospecting_enum($body,'authority_result',PROSPECTING_AUTHORITY_RESULTS);$budget=prospecting_enum($body,'budget_result',PROSPECTING_BUDGET_RESULTS);
    $estimated=prospecting_integer($body,'estimated_cost_centavos',0);$actual=prospecting_integer($body,'actual_cost_centavos',0,null,false);$confidence=prospecting_confidence($body);
    foreach(['state_before','state_after','governance_trace'] as $field)if(!isset($body[$field])||!is_array($body[$field])||array_is_list($body[$field]))throw new ProspectingError("{$field} must be a JSON object.",422);
    $publicId=prospecting_public_id('decision');
    try{
        $statement=$pdo->prepare('insert into prospecting_agent_decisions(public_id,owner_id,agent_run_id,step_number,action,reason,target,expected_information,authority_result,budget_result,estimated_cost_centavos,actual_cost_centavos,confidence,state_before_json,state_after_json,governance_trace_json) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
        $statement->execute([$publicId,$ownerId,$run['id'],$step,$action,$reason,$target,$expected,$authority,$budget,$estimated,$actual,$confidence,prospecting_json($body['state_before']),prospecting_json($body['state_after']),prospecting_json($body['governance_trace'])]);
    }catch(PDOException $error){if($error->getCode()==='23000')throw new ProspectingError('This agent run already has a decision for that step.',409);throw $error;}
    return ['public_id'=>$publicId,'run_public_id'=>$runPublic,'step_number'=>$step,'action'=>$action,'reason'=>$reason,'target'=>$target,'expected_information'=>$expected,'authority_result'=>$authority,'budget_result'=>$budget,'estimated_cost_centavos'=>$estimated,'actual_cost_centavos'=>$actual,'confidence'=>$confidence,'state_before'=>$body['state_before'],'state_after'=>$body['state_after'],'governance_trace'=>$body['governance_trace']];
}

function prospecting_agent_create_artifact(PDO $pdo,int $ownerId,array $body):array
{
    prospecting_reject_unknown($body,['prospect_public_id','qualification_public_id','type','content']);
    $prospectPublic=prospecting_text($body,'prospect_public_id',80);$prospect=prospecting_find($pdo,'prospecting_prospects',$ownerId,$prospectPublic,true);
    $qualificationPublic=prospecting_text($body,'qualification_public_id',80,false);$qualificationId=null;
    if($qualificationPublic!==null){$qualification=prospecting_find($pdo,'prospecting_qualifications',$ownerId,$qualificationPublic);if((int)$qualification['prospect_id']!==(int)$prospect['id'])throw new ProspectingError('The qualification does not belong to this prospect.',422);$qualificationId=(int)$qualification['id'];}
    $type=prospecting_enum($body,'type',PROSPECTING_ARTIFACT_TYPES);
    if(!array_key_exists('content',$body)||(!is_string($body['content'])&&!is_array($body['content'])))throw new ProspectingError('Artifact content must be text or a JSON value.',422);
    if(is_string($body['content'])&&trim($body['content'])==='')throw new ProspectingError('Artifact content cannot be empty.',422);
    $encoded=prospecting_json(['format'=>is_string($body['content'])?'text':'json','value'=>$body['content']]);
    $versionQuery=$pdo->prepare('select coalesce(max(version),0)+1 from prospecting_artifacts where owner_id=? and prospect_id=? and type=?');$versionQuery->execute([$ownerId,$prospect['id'],$type]);$version=(int)$versionQuery->fetchColumn();
    $publicId=prospecting_public_id('artifact');$statement=$pdo->prepare('insert into prospecting_artifacts(public_id,owner_id,prospect_id,qualification_id,type,version,content) values(?,?,?,?,?,?,?)');$statement->execute([$publicId,$ownerId,$prospect['id'],$qualificationId,$type,$version,$encoded]);
    return ['public_id'=>$publicId,'prospect_public_id'=>$prospectPublic,'qualification_public_id'=>$qualificationPublic,'type'=>$type,'version'=>$version,'content'=>$body['content'],'delivery_status'=>'INTERNAL_UNSENT'];
}

function prospecting_agent_expire_reservations(PDO $pdo,int $ownerId):void
{
    $statement=$pdo->prepare("update prospecting_budget_reservations set status='EXPIRED',released_at=utc_timestamp() where owner_id=? and status='RESERVED' and expires_at<=utc_timestamp()");$statement->execute([$ownerId]);
}

function prospecting_agent_reservation_row(array $row):array
{
    return ['public_id'=>$row['public_id'],'mission_public_id'=>$row['mission_public_id']??null,'prospect_public_id'=>$row['prospect_public_id']??null,'run_public_id'=>$row['run_public_id']??null,'provider'=>$row['provider'],'operation'=>$row['operation'],'estimated_cost_centavos'=>(int)$row['estimated_cost_centavos'],'reserved_cost_centavos'=>(int)$row['reserved_cost_centavos'],'actual_cost_centavos'=>$row['actual_cost_centavos']===null?null:(int)$row['actual_cost_centavos'],'status'=>$row['status'],'idempotency_key'=>$row['idempotency_key'],'expires_at'=>$row['expires_at'],'created_at'=>$row['created_at'],'updated_at'=>$row['updated_at'],'committed_at'=>$row['committed_at'],'released_at'=>$row['released_at']];
}

function prospecting_agent_fetch_reservation(PDO $pdo,int $ownerId,string $publicId,bool $lock=false):array
{
    $query=$pdo->prepare('select r.*,m.public_id mission_public_id,p.public_id prospect_public_id,ar.public_id run_public_id from prospecting_budget_reservations r join prospecting_missions m on m.id=r.mission_id and m.owner_id=r.owner_id left join prospecting_prospects p on p.id=r.prospect_id and p.owner_id=r.owner_id left join prospecting_agent_runs ar on ar.id=r.agent_run_id and ar.owner_id=r.owner_id where r.owner_id=? and r.public_id=?'.($lock?' for update':''));$query->execute([$ownerId,$publicId]);$row=$query->fetch();if(!$row)throw new ProspectingError('The budget reservation could not be found.',404);return $row;
}

function prospecting_agent_budget_totals(PDO $pdo,int $ownerId,int $missionId,?int $excludeReservationId=null):array
{
    $committedMission=$pdo->prepare('select coalesce(sum(actual_cost_centavos),0) from prospecting_cost_events where owner_id=? and mission_id=? and actual_cost_centavos is not null');$committedMission->execute([$ownerId,$missionId]);
    $activeMissionSql="select coalesce(sum(reserved_cost_centavos),0) from prospecting_budget_reservations where owner_id=? and mission_id=? and status='RESERVED' and expires_at>utc_timestamp()".($excludeReservationId===null?'':' and id<>?');$activeMission=$pdo->prepare($activeMissionSql);$params=[$ownerId,$missionId];if($excludeReservationId!==null)$params[]=$excludeReservationId;$activeMission->execute($params);
    $monthStart="date_format(utc_timestamp(),'%Y-%m-01 00:00:00')";
    $committedMonthly=$pdo->prepare("select coalesce(sum(actual_cost_centavos),0) from prospecting_cost_events where owner_id=? and actual_cost_centavos is not null and created_at>={$monthStart} and created_at<date_add({$monthStart},interval 1 month)");$committedMonthly->execute([$ownerId]);
    $activeMonthlySql="select coalesce(sum(reserved_cost_centavos),0) from prospecting_budget_reservations where owner_id=? and status='RESERVED' and expires_at>utc_timestamp()".($excludeReservationId===null?'':' and id<>?');$activeMonthly=$pdo->prepare($activeMonthlySql);$params=[$ownerId];if($excludeReservationId!==null)$params[]=$excludeReservationId;$activeMonthly->execute($params);
    return ['mission_committed'=>(int)$committedMission->fetchColumn(),'mission_reserved'=>(int)$activeMission->fetchColumn(),'monthly_committed'=>(int)$committedMonthly->fetchColumn(),'monthly_reserved'=>(int)$activeMonthly->fetchColumn()];
}

function prospecting_agent_monthly_budget(array $config):int
{
    $value=$config['prospecting_agent_monthly_budget_centavos']??200000;if(!is_int($value)||$value<0)throw new ProspectingError('The monthly prospecting budget is invalid.',503);return $value;
}

function prospecting_agent_reserve(PDO $pdo,int $ownerId,array $config,array $body):array
{
    prospecting_reject_unknown($body,['mission_public_id','prospect_public_id','run_public_id','provider','operation','estimated_cost_centavos','idempotency_key','ttl_seconds']);
    prospecting_agent_expire_reservations($pdo,$ownerId);
    $missionPublic=prospecting_text($body,'mission_public_id',80);$mission=prospecting_find($pdo,'prospecting_missions',$ownerId,$missionPublic,true);
    if($mission['status']!=='RUNNING')throw new ProspectingError('Budget may be reserved only for a RUNNING mission.',409);
    $prospectPublic=prospecting_text($body,'prospect_public_id',80,false);$prospectId=null;
    if($prospectPublic!==null){$prospect=prospecting_find($pdo,'prospecting_prospects',$ownerId,$prospectPublic);$prospectId=(int)$prospect['id'];}
    $runPublic=prospecting_text($body,'run_public_id',80,false);$runId=null;
    if($runPublic!==null){$run=prospecting_agent_fetch_run($pdo,$ownerId,$runPublic,true);$runId=(int)$run['id'];if((int)$run['mission_id']!==(int)$mission['id'])throw new ProspectingError('The agent run does not belong to this mission.',422);if($prospectId!==null&&(int)$run['prospect_id']!==$prospectId)throw new ProspectingError('The agent run does not belong to this prospect.',422);}
    $provider=prospecting_text($body,'provider',120);$operation=prospecting_text($body,'operation',120);$estimated=prospecting_integer($body,'estimated_cost_centavos',0);$key=prospecting_text($body,'idempotency_key',190);
    if(!preg_match('/^[A-Za-z0-9][A-Za-z0-9._:-]{7,189}$/D',$key))throw new ProspectingError('Invalid reservation idempotency_key.',422);
    $ttl=prospecting_integer($body,'ttl_seconds',1,86400,false)??900;
    $hash=hash('sha256',prospecting_json(prospecting_canonicalize($body)));
    $existing=$pdo->prepare('select public_id,request_hash from prospecting_budget_reservations where owner_id=? and idempotency_key=? for update');$existing->execute([$ownerId,$key]);$old=$existing->fetch();
    if($old){
        if(!hash_equals($old['request_hash'],$hash))throw new ProspectingError('The reservation idempotency key is bound to a different payload.',409);
        $reservation=prospecting_agent_reservation_row(prospecting_agent_fetch_reservation($pdo,$ownerId,$old['public_id'],true));
        $active=$reservation['status']==='RESERVED';
        return ['allowed'=>$active,'decision'=>$active?'ALLOW':'EXISTING_'.$reservation['status'],'idempotent_replay'=>true,'reservation'=>$reservation];
    }
    $totals=prospecting_agent_budget_totals($pdo,$ownerId,(int)$mission['id']);$monthlyBudget=prospecting_agent_monthly_budget($config);
    $missionAvailable=max(0,(int)$mission['mission_budget_centavos']-$totals['mission_committed']-$totals['mission_reserved']);$monthlyAvailable=max(0,$monthlyBudget-$totals['monthly_committed']-$totals['monthly_reserved']);
    if($estimated>$missionAvailable||$estimated>$monthlyAvailable)return ['allowed'=>false,'decision'=>'DENY_BUDGET','reason'=>$estimated>$missionAvailable?'Mission budget would be exceeded.':'Monthly owner budget would be exceeded.','mission_available_centavos'=>$missionAvailable,'monthly_available_centavos'=>$monthlyAvailable];
    $publicId=prospecting_public_id('reservation');$expires=gmdate('Y-m-d H:i:s',time()+$ttl);
    $insert=$pdo->prepare("insert into prospecting_budget_reservations(public_id,owner_id,mission_id,prospect_id,agent_run_id,provider,operation,estimated_cost_centavos,reserved_cost_centavos,status,idempotency_key,request_hash,expires_at) values(?,?,?,?,?,?,?,?,?,'RESERVED',?,?,?)");
    $insert->execute([$publicId,$ownerId,$mission['id'],$prospectId,$runId,$provider,$operation,$estimated,$estimated,$key,$hash,$expires]);
    return ['allowed'=>true,'decision'=>$estimated===0?'ALLOW_FREE':'ALLOW','idempotent_replay'=>false,'mission_available_centavos'=>$missionAvailable-$estimated,'monthly_available_centavos'=>$monthlyAvailable-$estimated,'reservation'=>prospecting_agent_reservation_row(prospecting_agent_fetch_reservation($pdo,$ownerId,$publicId,true))];
}

function prospecting_agent_commit_reservation(PDO $pdo,int $ownerId,array $config,array $body):array
{
    prospecting_reject_unknown($body,['reservation_public_id','actual_cost_centavos']);prospecting_agent_expire_reservations($pdo,$ownerId);
    $publicId=prospecting_text($body,'reservation_public_id',80);$actual=prospecting_integer($body,'actual_cost_centavos',0);$row=prospecting_agent_fetch_reservation($pdo,$ownerId,$publicId,true);
    if($row['status']==='COMMITTED'){
        if((int)$row['actual_cost_centavos']!==$actual)throw new ProspectingError('The committed reservation has a different actual cost.',409);
        return ['allowed'=>true,'decision'=>'COMMIT','idempotent_replay'=>true,'reservation'=>prospecting_agent_reservation_row($row)];
    }
    if($row['status']==='RECONCILIATION_REQUIRED'){
        if((int)$row['actual_cost_centavos']!==$actual)throw new ProspectingError('The reconciliation record has a different actual cost.',409);
        return ['allowed'=>false,'decision'=>'RECONCILIATION_REQUIRED','idempotent_replay'=>true,'reservation'=>prospecting_agent_reservation_row($row)];
    }
    if($row['status']!=='RESERVED')throw new ProspectingError('Only an active reservation can be committed.',409);
    $mission=prospecting_find($pdo,'prospecting_missions',$ownerId,$row['mission_public_id'],true);$totals=prospecting_agent_budget_totals($pdo,$ownerId,(int)$mission['id'],(int)$row['id']);$monthlyBudget=prospecting_agent_monthly_budget($config);
    $missionFits=$totals['mission_committed']+$totals['mission_reserved']+$actual<=(int)$mission['mission_budget_centavos'];$monthlyFits=$totals['monthly_committed']+$totals['monthly_reserved']+$actual<=$monthlyBudget;
    if(!$missionFits||!$monthlyFits){
        $update=$pdo->prepare("update prospecting_budget_reservations set status='RECONCILIATION_REQUIRED',actual_cost_centavos=? where owner_id=? and id=?");$update->execute([$actual,$ownerId,$row['id']]);
        $reloaded=prospecting_agent_fetch_reservation($pdo,$ownerId,$publicId,true);
        return ['allowed'=>false,'decision'=>'RECONCILIATION_REQUIRED','reason'=>$missionFits?'Actual cost would exceed the monthly budget.':'Actual cost would exceed the mission budget.','reservation'=>prospecting_agent_reservation_row($reloaded)];
    }
    $costPublic=prospecting_public_id('cost-event');$costKey='reservation:'.$publicId;
    $insert=$pdo->prepare('insert into prospecting_cost_events(public_id,owner_id,mission_id,prospect_id,agent_run_id,provider,operation,estimated_cost_centavos,actual_cost_centavos,idempotency_key) values(?,?,?,?,?,?,?,?,?,?)');
    $insert->execute([$costPublic,$ownerId,$row['mission_id'],$row['prospect_id'],$row['agent_run_id'],$row['provider'],$row['operation'],$row['estimated_cost_centavos'],$actual,$costKey]);
    $update=$pdo->prepare("update prospecting_budget_reservations set status='COMMITTED',actual_cost_centavos=?,committed_at=utc_timestamp() where owner_id=? and id=?");$update->execute([$actual,$ownerId,$row['id']]);
    return ['allowed'=>true,'decision'=>'COMMIT','idempotent_replay'=>false,'unused_reservation_released_centavos'=>max(0,(int)$row['reserved_cost_centavos']-$actual),'cost_event_public_id'=>$costPublic,'reservation'=>prospecting_agent_reservation_row(prospecting_agent_fetch_reservation($pdo,$ownerId,$publicId,true))];
}

function prospecting_agent_release_reservation(PDO $pdo,int $ownerId,array $body):array
{
    prospecting_reject_unknown($body,['reservation_public_id','reason']);prospecting_agent_expire_reservations($pdo,$ownerId);
    $publicId=prospecting_text($body,'reservation_public_id',80);prospecting_text($body,'reason',500);
    $row=prospecting_agent_fetch_reservation($pdo,$ownerId,$publicId,true);
    if(in_array($row['status'],['RELEASED','EXPIRED'],true))return ['released'=>true,'idempotent_replay'=>true,'reservation'=>prospecting_agent_reservation_row($row)];
    if($row['status']==='COMMITTED')throw new ProspectingError('A committed reservation cannot be released.',409);
    if($row['status']==='RECONCILIATION_REQUIRED')throw new ProspectingError('A reconciliation-required reservation cannot be released.',409);
    $update=$pdo->prepare("update prospecting_budget_reservations set status='RELEASED',released_at=utc_timestamp() where owner_id=? and id=?");$update->execute([$ownerId,$row['id']]);
    return ['released'=>true,'idempotent_replay'=>false,'reservation'=>prospecting_agent_reservation_row(prospecting_agent_fetch_reservation($pdo,$ownerId,$publicId,true))];
}

function prospecting_agent_dispatch(PDO $pdo,int $ownerId,array $config,string $operation,array $payload):array
{
    return match($operation){
        'CREATE_RUN'=>[['run'=>prospecting_agent_create_run($pdo,$ownerId,$payload)],201],
        'UPDATE_RUN'=>[['run'=>prospecting_agent_update_run($pdo,$ownerId,$payload)],200],
        'APPEND_DECISION'=>[['decision'=>prospecting_agent_append_decision($pdo,$ownerId,$payload)],201],
        'CREATE_ARTIFACT'=>[['artifact'=>prospecting_agent_create_artifact($pdo,$ownerId,$payload)],201],
        'RESERVE_BUDGET'=>array_values((function()use($pdo,$ownerId,$config,$payload){$result=prospecting_agent_reserve($pdo,$ownerId,$config,$payload);return [$result,$result['allowed']?201:409];})()),
        'COMMIT_RESERVATION'=>array_values((function()use($pdo,$ownerId,$config,$payload){$result=prospecting_agent_commit_reservation($pdo,$ownerId,$config,$payload);return [$result,$result['allowed']?200:409];})()),
        'RELEASE_RESERVATION'=>[['release'=>prospecting_agent_release_reservation($pdo,$ownerId,$payload)],200],
        default=>throw new ProspectingError('Unsupported agent persistence operation.',422),
    };
}

function prospecting_agent_ingest_route(PDO $pdo,array $config):void
{
    try{
        if($_SERVER['REQUEST_METHOD']!=='POST')throw new ProspectingError('Method not allowed.',405);
        $pdo->exec("set time_zone='+00:00'");
        $ownerId=prospecting_agent_authenticate($config);$body=prospecting_request_body();prospecting_reject_unknown($body,['request_id','operation','payload']);
        $requestId=prospecting_text($body,'request_id',190);if(!preg_match('/^[A-Za-z0-9][A-Za-z0-9._:-]{7,189}$/D',$requestId))throw new ProspectingError('Invalid request_id.',422);
        $operation=prospecting_text($body,'operation',80);$payload=$body['payload']??null;if(!is_array($payload)||array_is_list($payload))throw new ProspectingError('payload must be a JSON object.',422);
        $payloadHash=hash('sha256',prospecting_json(prospecting_canonicalize(['operation'=>$operation,'payload'=>$payload])));
        $pdo->beginTransaction();
        $owner=$pdo->prepare('select id from studio_users where id=? for update');$owner->execute([$ownerId]);if(!$owner->fetch())throw new ProspectingError('Agent owner scope is unavailable.',403);
        $existing=$pdo->prepare('select operation,payload_hash,response_status,response_json from prospecting_agent_ingest_requests where owner_id=? and request_id=? for update');$existing->execute([$ownerId,$requestId]);$old=$existing->fetch();
        if($old){
            if($old['operation']!==$operation||!hash_equals($old['payload_hash'],$payloadHash))throw new ProspectingError('The request_id is already bound to a different operation or payload.',409);
            $response=json_decode($old['response_json'],true,128,JSON_THROW_ON_ERROR);$response['idempotent_request_replay']=true;$status=(int)$old['response_status'];$pdo->commit();respond($response,$status);
        }
        [$result,$status]=prospecting_agent_dispatch($pdo,$ownerId,$config,$operation,$payload);$response=['operation'=>$operation,'result'=>$result,'idempotent_request_replay'=>false];
        $insert=$pdo->prepare('insert into prospecting_agent_ingest_requests(owner_id,request_id,operation,payload_hash,response_status,response_json) values(?,?,?,?,?,?)');$insert->execute([$ownerId,$requestId,$operation,$payloadHash,$status,prospecting_json($response)]);
        $pdo->commit();respond($response,$status);
    }catch(ProspectingError $error){if($pdo->inTransaction())$pdo->rollBack();respond(['error'=>$error->getMessage()],$error->getCode());}
    catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();error_log('Studio prospecting agent ingest failed: '.get_class($error));respond(['error'=>'Prospecting agent persistence is temporarily unavailable. No action was executed.'],503);}
}
