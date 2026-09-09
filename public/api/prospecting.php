<?php
declare(strict_types=1);

// Private, authenticated persistence routes only. No discovery, agent execution,
// external requests, outreach, or Studio inquiry promotion is implemented here.
final class ProspectingError extends RuntimeException {}

const PROSPECTING_MISSION_STATUSES = ['DRAFT','READY','RUNNING','PAUSED','COMPLETED','CANCELLED','FAILED','BUDGET_EXHAUSTED'];
const PROSPECTING_PROSPECT_STATUSES = ['DISCOVERED','RESEARCHING','INSUFFICIENT_EVIDENCE','DISQUALIFIED','QUALIFIED','PENDING_APPROVAL','APPROVED','REJECTED','PROMOTED_TO_STUDIO','FAILED'];
const PROSPECTING_CONTACT_STATUSES = ['FOUND','CONTACT_FORM_ONLY','SOCIAL_ONLY','NOT_FOUND','UNVERIFIED'];
const PROSPECTING_CONTACT_TYPES = ['EMAIL','PHONE','CONTACT_FORM','INSTAGRAM','FACEBOOK','OTHER'];
const PROSPECTING_CONTACT_VERIFICATION = ['VERIFIED','UNVERIFIED'];
const PROSPECTING_APPROVAL_ACTIONS = ['APPROVE_PROSPECT','REJECT_PROSPECT','PROMOTE_TO_STUDIO','APPROVE_OUTREACH'];
const PROSPECTING_APPROVAL_STATUSES = ['PENDING','APPROVED','REJECTED','CANCELLED'];
const PROSPECTING_SOURCE_TYPES = ['WEBSITE','SEARCH_RESULT','BUSINESS_DIRECTORY','MANUAL','OTHER'];
const PROSPECTING_MEMBERSHIP_STATUSES = ['CANDIDATE','ACTIVE','QUALIFIED','DISQUALIFIED','REJECTED','COMPLETED','DUPLICATE'];
const PROSPECTING_SCORING_RULE_VERSION = 'cinematicflight-v1';

const PROSPECTING_MISSION_TRANSITIONS = [
    'DRAFT'=>['READY','CANCELLED'], 'READY'=>['RUNNING','CANCELLED','FAILED'],
    'RUNNING'=>['PAUSED','COMPLETED','CANCELLED','FAILED','BUDGET_EXHAUSTED'],
    'PAUSED'=>['READY','RUNNING','CANCELLED','FAILED','BUDGET_EXHAUSTED'],
    'COMPLETED'=>[], 'CANCELLED'=>[], 'FAILED'=>['READY'], 'BUDGET_EXHAUSTED'=>['READY','CANCELLED'],
];
const PROSPECTING_PROSPECT_TRANSITIONS = [
    'DISCOVERED'=>['RESEARCHING'],
    'RESEARCHING'=>['INSUFFICIENT_EVIDENCE','DISQUALIFIED','QUALIFIED','FAILED'],
    'INSUFFICIENT_EVIDENCE'=>['RESEARCHING'], 'DISQUALIFIED'=>['RESEARCHING'],
    'QUALIFIED'=>['PENDING_APPROVAL','RESEARCHING'],
    'PENDING_APPROVAL'=>['APPROVED','REJECTED','RESEARCHING'],
    'APPROVED'=>['PROMOTED_TO_STUDIO','RESEARCHING'], 'REJECTED'=>['RESEARCHING'],
    'PROMOTED_TO_STUDIO'=>[], 'FAILED'=>['RESEARCHING'],
];

function prospecting_request_body(): array
{
    $length = isset($_SERVER['CONTENT_LENGTH']) ? (int) $_SERVER['CONTENT_LENGTH'] : 0;
    if ($length > 65536) throw new ProspectingError('Prospecting request exceeds 64 KB.', 413);
    $raw = file_get_contents('php://input', false, null, 0, 65537);
    if ($raw === false || strlen($raw) > 65536) throw new ProspectingError('Prospecting request exceeds 64 KB.', 413);
    try {
        $body = json_decode($raw === '' ? '{}' : $raw, true, 128, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        throw new ProspectingError('Provide valid JSON.', 400);
    }
    if (!is_array($body) || array_is_list($body)) throw new ProspectingError('Provide a JSON object.', 400);
    return $body;
}

function prospecting_reject_unknown(array $body, array $allowed): void
{
    $unknown = array_diff(array_keys($body), $allowed);
    if ($unknown) throw new ProspectingError('Unknown field: ' . (string) reset($unknown) . '.', 422);
}

function prospecting_text(array $body, string $key, int $maximum, bool $required = true): ?string
{
    if (!array_key_exists($key, $body) || $body[$key] === null) {
        if ($required) throw new ProspectingError("{$key} is required.", 422);
        return null;
    }
    if (!is_string($body[$key]) || str_contains($body[$key], "\0")) throw new ProspectingError("{$key} must be text.", 422);
    $value = trim($body[$key]);
    if (($required && $value === '') || strlen($value) > $maximum) throw new ProspectingError("Invalid {$key}.", 422);
    return $value === '' ? null : $value;
}

function prospecting_integer(array $body, string $key, int $minimum = 0, ?int $maximum = null, bool $required = true): ?int
{
    if (!array_key_exists($key, $body) || $body[$key] === null) {
        if ($required) throw new ProspectingError("{$key} is required.", 422);
        return null;
    }
    $value = $body[$key];
    if (!is_int($value) || $value < $minimum || ($maximum !== null && $value > $maximum)) {
        throw new ProspectingError("{$key} must be an integer in the allowed range.", 422);
    }
    return $value;
}

function prospecting_confidence(array $body): float
{
    $value = $body['confidence'] ?? null;
    if ((!is_int($value) && !is_float($value)) || !is_finite((float) $value) || $value < 0 || $value > 1) {
        throw new ProspectingError('confidence must be from 0 to 1.', 422);
    }
    return (float) $value;
}

function prospecting_enum(array $body, string $key, array $allowed, bool $required = true): ?string
{
    $value = prospecting_text($body, $key, 80, $required);
    if ($value === null) return null;
    if (!in_array($value, $allowed, true)) throw new ProspectingError("Invalid {$key}.", 422);
    return $value;
}

function prospecting_bool(array $body, string $key, bool $default = false): bool
{
    if (!array_key_exists($key, $body)) return $default;
    if (!is_bool($body[$key])) throw new ProspectingError("{$key} must be true or false.", 422);
    return $body[$key];
}

function prospecting_public_id(string $prefix): string
{
    $bytes = random_bytes(16);
    $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
    $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
    $hex = bin2hex($bytes);
    return sprintf('%s_%s-%s-%s-%s-%s', $prefix, substr($hex,0,8), substr($hex,8,4), substr($hex,12,4), substr($hex,16,4), substr($hex,20));
}

function prospecting_query_public_id(string $key, string $prefix): string
{
    $value = trim((string) ($_GET[$key] ?? ''));
    $pattern = '/^' . preg_quote($prefix, '/') . '_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/D';
    if (!preg_match($pattern, $value)) throw new ProspectingError('The requested resource could not be found.', 404);
    return $value;
}

function prospecting_url(?string $value, string $field, bool $required = false): ?string
{
    if ($value === null) {
        if ($required) throw new ProspectingError("{$field} is required.", 422);
        return null;
    }
    $parts = parse_url($value);
    if ($parts === false || !isset($parts['scheme'], $parts['host']) || !in_array(strtolower($parts['scheme']), ['http','https'], true)) {
        throw new ProspectingError("{$field} must be an absolute HTTP or HTTPS URL.", 422);
    }
    return $value;
}

function prospecting_categories(array $body): array
{
    $categories = $body['target_categories'] ?? null;
    if (!is_array($categories) || !array_is_list($categories) || count($categories) < 1 || count($categories) > 50) {
        throw new ProspectingError('target_categories must contain between 1 and 50 values.', 422);
    }
    $clean = [];
    foreach ($categories as $category) {
        if (!is_string($category) || trim($category) === '' || strlen(trim($category)) > 120) throw new ProspectingError('Invalid target category.', 422);
        $clean[] = trim($category);
    }
    return array_values(array_unique($clean));
}

function prospecting_json(mixed $value): string
{
    return json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
}

function prospecting_canonicalize(mixed $value): mixed
{
    if (!is_array($value)) return $value;
    if (array_is_list($value)) return array_map('prospecting_canonicalize', $value);
    ksort($value, SORT_STRING);
    foreach ($value as $key => $item) $value[$key] = prospecting_canonicalize($item);
    return $value;
}

function prospecting_find(PDO $pdo, string $table, int $ownerId, string $publicId, bool $lock = false): array
{
    $allowed = ['prospecting_missions','prospecting_prospects','prospecting_qualifications','prospecting_agent_runs'];
    if (!in_array($table, $allowed, true)) throw new LogicException('Unsupported prospecting table.');
    $statement = $pdo->prepare("select * from {$table} where owner_id=? and public_id=? limit 1" . ($lock ? ' for update' : ''));
    $statement->execute([$ownerId, $publicId]);
    $row = $statement->fetch();
    if (!$row) throw new ProspectingError('The requested resource could not be found.', 404);
    return $row;
}

function prospecting_mission_row(array $row): array
{
    return [
        'public_id'=>$row['public_id'], 'name'=>$row['name'], 'objective'=>$row['objective'], 'location'=>$row['location'],
        'target_categories'=>json_decode((string) $row['target_categories_json'], true, 128, JSON_THROW_ON_ERROR),
        'target_qualified_leads'=>(int) $row['target_qualified_leads'], 'minimum_score'=>(int) $row['minimum_score'],
        'mission_budget_centavos'=>(int) $row['mission_budget_centavos'], 'status'=>$row['status'],
        'created_at'=>$row['created_at'], 'updated_at'=>$row['updated_at'],
    ];
}

function prospecting_prospect_row(array $row): array
{
    return [
        'public_id'=>$row['public_id'], 'business_name'=>$row['business_name'], 'category'=>$row['category'],
        'address'=>$row['address'], 'location'=>$row['location'], 'website'=>$row['website'], 'phone'=>$row['phone'],
        'rating'=>$row['rating'] === null ? null : (float) $row['rating'], 'review_count'=>$row['review_count'] === null ? null : (int) $row['review_count'],
        'external_source'=>$row['external_source'], 'external_source_id'=>$row['external_source_id'],
        'normalized_domain'=>$row['normalized_domain'], 'status'=>$row['status'], 'contact_status'=>$row['contact_status'],
        'created_at'=>$row['created_at'], 'updated_at'=>$row['updated_at'],
    ];
}

function prospecting_normalized_domain(?string $website): ?string
{
    if ($website === null) return null;
    $host = strtolower((string) parse_url($website, PHP_URL_HOST));
    return str_starts_with($host, 'www.') ? substr($host, 4) : $host;
}

function prospecting_assert_transition(array $map, string $from, string $to, string $entity): void
{
    if (!isset($map[$from]) || !in_array($to, $map[$from], true)) throw new ProspectingError("Invalid {$entity} transition: {$from} -> {$to}.", 409);
}

function prospecting_create_mission(PDO $pdo, int $ownerId, array $body): array
{
    prospecting_reject_unknown($body, ['name','objective','location','target_categories','target_qualified_leads','minimum_score','mission_budget_centavos','status']);
    $status = prospecting_enum($body, 'status', PROSPECTING_MISSION_STATUSES, false) ?? 'DRAFT';
    if ($status !== 'DRAFT') throw new ProspectingError('New missions must begin in DRAFT.', 422);
    $publicId = prospecting_public_id('mission');
    $statement = $pdo->prepare('insert into prospecting_missions(public_id,owner_id,name,objective,location,target_categories_json,target_qualified_leads,minimum_score,mission_budget_centavos,status) values(?,?,?,?,?,?,?,?,?,?)');
    $statement->execute([$publicId,$ownerId,prospecting_text($body,'name',190),prospecting_text($body,'objective',10000),prospecting_text($body,'location',255),prospecting_json(prospecting_categories($body)),prospecting_integer($body,'target_qualified_leads',1,100000),prospecting_integer($body,'minimum_score',0,100),prospecting_integer($body,'mission_budget_centavos',0),$status]);
    return prospecting_mission_row(prospecting_find($pdo, 'prospecting_missions', $ownerId, $publicId));
}

function prospecting_patch_mission(PDO $pdo, int $ownerId, string $publicId, array $body): array
{
    $allowed = ['name','objective','location','target_categories','target_qualified_leads','minimum_score','mission_budget_centavos','status'];
    prospecting_reject_unknown($body, $allowed);
    if (!$body) throw new ProspectingError('Provide at least one mission change.', 422);
    $pdo->beginTransaction();
    try {
        $current = prospecting_find($pdo, 'prospecting_missions', $ownerId, $publicId, true);
        $values = [];
        $sets = [];
        foreach ($body as $key => $_) {
            if ($key === 'status') {
                $value = prospecting_enum($body, $key, PROSPECTING_MISSION_STATUSES);
                prospecting_assert_transition(PROSPECTING_MISSION_TRANSITIONS, $current['status'], $value, 'mission');
            } elseif ($key === 'target_categories') {
                $value = prospecting_json(prospecting_categories($body));
                $key = 'target_categories_json';
            } elseif ($key === 'target_qualified_leads') $value = prospecting_integer($body,$key,1,100000);
            elseif ($key === 'minimum_score') $value = prospecting_integer($body,$key,0,100);
            elseif ($key === 'mission_budget_centavos') $value = prospecting_integer($body,$key,0);
            else $value = prospecting_text($body,$key,$key === 'name' ? 190 : ($key === 'location' ? 255 : 10000));
            $sets[] = "{$key}=?"; $values[] = $value;
        }
        $values[] = $ownerId; $values[] = $publicId;
        $statement = $pdo->prepare('update prospecting_missions set ' . implode(',', $sets) . ' where owner_id=? and public_id=?');
        $statement->execute($values);
        $row = prospecting_mission_row(prospecting_find($pdo, 'prospecting_missions', $ownerId, $publicId));
        $pdo->commit();
        return $row;
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}

function prospecting_create_prospect(PDO $pdo, int $ownerId, array $body): array
{
    $allowed = ['business_name','category','address','location','website','phone','rating','review_count','external_source','external_source_id','status'];
    prospecting_reject_unknown($body, $allowed);
    $status = prospecting_enum($body, 'status', PROSPECTING_PROSPECT_STATUSES, false) ?? 'DISCOVERED';
    if ($status !== 'DISCOVERED') throw new ProspectingError('New prospects must begin in DISCOVERED.', 422);
    $website = prospecting_url(prospecting_text($body,'website',2048,false), 'website');
    $rating = $body['rating'] ?? null;
    if ($rating !== null && ((!is_int($rating) && !is_float($rating)) || $rating < 0 || $rating > 5)) throw new ProspectingError('rating must be from 0 to 5.', 422);
    $phone = prospecting_text($body,'phone',80,false);
    $publicId = prospecting_public_id('prospect');
    $statement = $pdo->prepare('insert into prospecting_prospects(public_id,owner_id,business_name,category,address,location,website,phone,rating,review_count,external_source,external_source_id,normalized_domain,status,contact_status) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
    $statement->execute([$publicId,$ownerId,prospecting_text($body,'business_name',190),prospecting_text($body,'category',120),prospecting_text($body,'address',500,false),prospecting_text($body,'location',255),$website,$phone,$rating,prospecting_integer($body,'review_count',0,null,false),prospecting_text($body,'external_source',100,false),prospecting_text($body,'external_source_id',255,false),prospecting_normalized_domain($website),$status,$phone === null ? 'NOT_FOUND' : 'UNVERIFIED']);
    return prospecting_prospect_row(prospecting_find($pdo, 'prospecting_prospects', $ownerId, $publicId));
}

function prospecting_patch_prospect(PDO $pdo, int $ownerId, string $publicId, array $body): array
{
    $allowed = ['business_name','category','address','location','website','phone','rating','review_count','external_source','external_source_id','status','contact_status'];
    prospecting_reject_unknown($body, $allowed);
    if (!$body) throw new ProspectingError('Provide at least one prospect change.', 422);
    $pdo->beginTransaction();
    try {
        $current = prospecting_find($pdo, 'prospecting_prospects', $ownerId, $publicId, true);
        $sets=[]; $values=[];
        foreach ($body as $key => $raw) {
            if ($key === 'status') {
                $value=prospecting_enum($body,$key,PROSPECTING_PROSPECT_STATUSES);
                if(in_array($value,['QUALIFIED','DISQUALIFIED','INSUFFICIENT_EVIDENCE'],true))throw new ProspectingError('Qualification states must be produced by the deterministic qualification endpoint.',409);
                if(in_array($value,['APPROVED','REJECTED'],true))throw new ProspectingError('Approval states must be produced with an append-only approval record.',409);
                if($value==='PROMOTED_TO_STUDIO')throw new ProspectingError('Studio promotion is unavailable in Phase 3.',409);
                prospecting_assert_transition(PROSPECTING_PROSPECT_TRANSITIONS,$current['status'],$value,'prospect');
            } elseif ($key === 'contact_status') $value=prospecting_enum($body,$key,PROSPECTING_CONTACT_STATUSES);
            elseif ($key === 'website') {
                $value=prospecting_url(prospecting_text($body,$key,2048,false),$key);
                $sets[]='normalized_domain=?'; $values[]=prospecting_normalized_domain($value);
            } elseif ($key === 'rating') {
                if ($raw !== null && ((!is_int($raw) && !is_float($raw)) || $raw < 0 || $raw > 5)) throw new ProspectingError('rating must be from 0 to 5.',422);
                $value=$raw;
            } elseif ($key === 'review_count') $value=prospecting_integer($body,$key,0,null,false);
            else {
                $max=['business_name'=>190,'category'=>120,'address'=>500,'location'=>255,'phone'=>80,'external_source'=>100,'external_source_id'=>255][$key];
                $value=prospecting_text($body,$key,$max,in_array($key,['business_name','category','location'],true));
            }
            $sets[]="{$key}=?"; $values[]=$value;
        }
        $values[]=$ownerId; $values[]=$publicId;
        $statement=$pdo->prepare('update prospecting_prospects set '.implode(',',$sets).' where owner_id=? and public_id=?');
        $statement->execute($values);
        $row=prospecting_prospect_row(prospecting_find($pdo,'prospecting_prospects',$ownerId,$publicId));
        $pdo->commit();
        return $row;
    } catch(Throwable $error) {
        if($pdo->inTransaction())$pdo->rollBack();
        throw $error;
    }
}

function prospecting_membership(PDO $pdo, int $ownerId, string $missionPublicId, array $body): array
{
    prospecting_reject_unknown($body, ['prospect_public_id','discovery_source','mission_status','rank']);
    $mission=prospecting_find($pdo,'prospecting_missions',$ownerId,$missionPublicId);
    $prospectId=prospecting_text($body,'prospect_public_id',80);
    if(!preg_match('/^prospect_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/D',$prospectId))throw new ProspectingError('The prospect could not be found.',404);
    $prospect=prospecting_find($pdo,'prospecting_prospects',$ownerId,$prospectId);
    $source=prospecting_text($body,'discovery_source',120);
    $status=prospecting_enum($body,'mission_status',PROSPECTING_MEMBERSHIP_STATUSES,false)??'CANDIDATE';
    $rank=prospecting_integer($body,'rank',0,null,false);
    try {
        $statement=$pdo->prepare('insert into prospecting_mission_prospects(mission_id,prospect_id,discovery_source,mission_status,rank) values(?,?,?,?,?)');
        $statement->execute([(int)$mission['id'],(int)$prospect['id'],$source,$status,$rank]);
        $duplicate=false;
    } catch(PDOException $error) {
        if($error->getCode()!=='23000')throw $error;
        $duplicate=true;
    }
    $query=$pdo->prepare('select mp.discovery_source,mp.mission_status,mp.rank,mp.discovered_at,p.public_id as prospect_public_id,p.business_name,p.category,p.location from prospecting_mission_prospects mp join prospecting_prospects p on p.id=mp.prospect_id and p.owner_id=? where mp.mission_id=? and mp.prospect_id=?');
    $query->execute([$ownerId,$mission['id'],$prospect['id']]);
    $row=$query->fetch();
    return ['duplicate'=>$duplicate,'membership'=>['prospect_public_id'=>$row['prospect_public_id'],'business_name'=>$row['business_name'],'category'=>$row['category'],'location'=>$row['location'],'discovery_source'=>$row['discovery_source'],'mission_status'=>$row['mission_status'],'rank'=>$row['rank']===null?null:(int)$row['rank'],'discovered_at'=>$row['discovered_at']]];
}

function prospecting_list_memberships(PDO $pdo, int $ownerId, string $missionPublicId): array
{
    $mission=prospecting_find($pdo,'prospecting_missions',$ownerId,$missionPublicId);
    $query=$pdo->prepare('select mp.discovery_source,mp.mission_status,mp.rank,mp.discovered_at,p.public_id as prospect_public_id,p.business_name,p.category,p.location from prospecting_mission_prospects mp join prospecting_prospects p on p.id=mp.prospect_id and p.owner_id=? where mp.mission_id=? order by mp.rank is null,mp.rank,mp.id');
    $query->execute([$ownerId,$mission['id']]);
    return array_map(static fn(array $row):array=>['prospect_public_id'=>$row['prospect_public_id'],'business_name'=>$row['business_name'],'category'=>$row['category'],'location'=>$row['location'],'discovery_source'=>$row['discovery_source'],'mission_status'=>$row['mission_status'],'rank'=>$row['rank']===null?null:(int)$row['rank'],'discovered_at'=>$row['discovered_at']],$query->fetchAll());
}

function prospecting_create_evidence(PDO $pdo,int $ownerId,string $prospectPublicId,array $body):array
{
    prospecting_reject_unknown($body,['agent_run_public_id','source_type','source_url','page_title','observation_type','claim','observation','captured_at']);
    $prospect=prospecting_find($pdo,'prospecting_prospects',$ownerId,$prospectPublicId);
    $runId=null;
    $runPublic=prospecting_text($body,'agent_run_public_id',80,false);
    if($runPublic!==null){$run=prospecting_find($pdo,'prospecting_agent_runs',$ownerId,$runPublic);if((int)$run['prospect_id']!==(int)$prospect['id'])throw new ProspectingError('The agent run does not belong to this prospect.',422);$runId=(int)$run['id'];}
    $sourceType=prospecting_enum($body,'source_type',PROSPECTING_SOURCE_TYPES);
    $sourceUrl=prospecting_url(prospecting_text($body,'source_url',2048),'source_url',true);
    $pageTitle=prospecting_text($body,'page_title',500,false);
    $observationType=prospecting_text($body,'observation_type',120);
    $claim=prospecting_text($body,'claim',10000);
    $observation=prospecting_text($body,'observation',30000);
    $captured=prospecting_text($body,'captured_at',40);
    $date=DateTimeImmutable::createFromFormat(DateTimeInterface::ATOM,$captured);
    if(!$date)throw new ProspectingError('captured_at must be an ISO 8601 timestamp.',422);
    $hash=hash('sha256',prospecting_json(prospecting_canonicalize(['source_type'=>$sourceType,'source_url'=>$sourceUrl,'page_title'=>$pageTitle,'observation_type'=>$observationType,'claim'=>$claim,'observation'=>$observation,'captured_at'=>$date->format(DateTimeInterface::ATOM)])));
    $publicId=prospecting_public_id('evidence');
    $statement=$pdo->prepare('insert into prospecting_evidence(public_id,owner_id,prospect_id,agent_run_id,source_type,source_url,page_title,observation_type,claim,observation,content_hash,captured_at) values(?,?,?,?,?,?,?,?,?,?,?,?)');
    $statement->execute([$publicId,$ownerId,$prospect['id'],$runId,$sourceType,$sourceUrl,$pageTitle,$observationType,$claim,$observation,$hash,$date->format('Y-m-d H:i:s')]);
    return ['public_id'=>$publicId,'source_type'=>$sourceType,'source_url'=>$sourceUrl,'page_title'=>$pageTitle,'observation_type'=>$observationType,'claim'=>$claim,'observation'=>$observation,'content_hash'=>$hash,'captured_at'=>$date->format('Y-m-d H:i:s')];
}

function prospecting_list_evidence(PDO $pdo,int $ownerId,string $prospectPublicId):array
{
    $prospect=prospecting_find($pdo,'prospecting_prospects',$ownerId,$prospectPublicId);
    $query=$pdo->prepare('select public_id,source_type,source_url,page_title,observation_type,claim,observation,content_hash,captured_at,created_at from prospecting_evidence where owner_id=? and prospect_id=? order by id');
    $query->execute([$ownerId,$prospect['id']]);
    return $query->fetchAll();
}

function prospecting_create_contact(PDO $pdo,int $ownerId,string $prospectPublicId,array $body):array
{
    prospecting_reject_unknown($body,['type','value','source_url','verification_status','is_primary']);
    $prospect=prospecting_find($pdo,'prospecting_prospects',$ownerId,$prospectPublicId);
    $type=prospecting_enum($body,'type',PROSPECTING_CONTACT_TYPES);
    $value=prospecting_text($body,'value',2048);
    if($type==='EMAIL'&&!filter_var($value,FILTER_VALIDATE_EMAIL))throw new ProspectingError('Provide a valid observed email address.',422);
    $sourceUrl=prospecting_url(prospecting_text($body,'source_url',2048),'source_url',true);
    $verification=prospecting_enum($body,'verification_status',PROSPECTING_CONTACT_VERIFICATION,false)??'UNVERIFIED';
    $primary=prospecting_bool($body,'is_primary');
    $publicId=prospecting_public_id('contact');
    $statement=$pdo->prepare('insert into prospecting_contacts(public_id,owner_id,prospect_id,type,value,source_url,verification_status,is_primary) values(?,?,?,?,?,?,?,?)');
    $statement->execute([$publicId,$ownerId,$prospect['id'],$type,$value,$sourceUrl,$verification,$primary?1:0]);
    return ['public_id'=>$publicId,'type'=>$type,'value'=>$value,'source_url'=>$sourceUrl,'verification_status'=>$verification,'is_primary'=>$primary];
}

function prospecting_list_contacts(PDO $pdo,int $ownerId,string $prospectPublicId):array
{
    $prospect=prospecting_find($pdo,'prospecting_prospects',$ownerId,$prospectPublicId);
    $query=$pdo->prepare('select public_id,type,value,source_url,verification_status,is_primary,created_at,updated_at from prospecting_contacts where owner_id=? and prospect_id=? order by is_primary desc,id');
    $query->execute([$ownerId,$prospect['id']]);
    $rows=$query->fetchAll();foreach($rows as &$row)$row['is_primary']=(bool)$row['is_primary'];unset($row);
    return $rows;
}

function prospecting_score(array $body,int $threshold):array
{
    $scores=[];
    foreach(['experience_gap_score','walkthrough_fit_score','commercial_fit_score','visual_property_score','contactability_score'] as $field)$scores[$field]=prospecting_integer($body,$field,0,100);
    $weightedRaw=($scores['experience_gap_score']*30+$scores['walkthrough_fit_score']*25+$scores['commercial_fit_score']*20+$scores['visual_property_score']*15+$scores['contactability_score']*10)/100;
    $penalty=0;
    if(prospecting_bool($body,'existing_strong_interactive_walkthrough'))$penalty-=20;
    if(prospecting_bool($body,'weak_physical_space_relevance'))$penalty-=30;
    if(prospecting_bool($body,'no_official_website'))$penalty-=10;
    $duplicate=prospecting_bool($body,'duplicate');
    $evidenceSufficient=prospecting_bool($body,'evidence_sufficient',true);
    $final=max(0,min(100,(int)round($weightedRaw+$penalty)));
    $priority=$final>=90?'HOT':($final>=75?'HIGH':($final>=60?'MEDIUM':'LOW'));
    $status=!$evidenceSufficient?'INSUFFICIENT_EVIDENCE':(($duplicate||$final<$threshold)?'DISQUALIFIED':'QUALIFIED');
    return $scores+['penalty_score'=>$penalty,'final_score'=>$final,'priority'=>$priority,'qualification_status'=>$status];
}

function prospecting_create_qualification(PDO $pdo,int $ownerId,string $prospectPublicId,array $body):array
{
    prospecting_reject_unknown($body,['experience_gap_score','walkthrough_fit_score','commercial_fit_score','visual_property_score','contactability_score','existing_strong_interactive_walkthrough','weak_physical_space_relevance','no_official_website','duplicate','evidence_sufficient','confidence','experience_gap_summary','primary_marketing_problem','cinematicflight_opportunity','final_score','priority','qualification_status']);
    $pdo->beginTransaction();
    try {
        $prospect=prospecting_find($pdo,'prospecting_prospects',$ownerId,$prospectPublicId,true);
        if($prospect['status']!=='RESEARCHING')throw new ProspectingError('Qualifications may be appended only while the prospect is RESEARCHING.',409);
        $missionThreshold=75;
        $score=prospecting_score($body,$missionThreshold);
        prospecting_assert_transition(PROSPECTING_PROSPECT_TRANSITIONS,$prospect['status'],$score['qualification_status'],'prospect');
        // The locked prospect row serializes qualification version allocation.
        $versionQuery=$pdo->prepare('select coalesce(max(version),0)+1 from prospecting_qualifications where owner_id=? and prospect_id=?');
        $versionQuery->execute([$ownerId,$prospect['id']]);$version=(int)$versionQuery->fetchColumn();
        $publicId=prospecting_public_id('qualification');
        $statement=$pdo->prepare('insert into prospecting_qualifications(public_id,owner_id,prospect_id,version,experience_gap_score,walkthrough_fit_score,commercial_fit_score,visual_property_score,contactability_score,penalty_score,final_score,priority,qualification_status,confidence,experience_gap_summary,primary_marketing_problem,cinematicflight_opportunity,scoring_rule_version) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
        $statement->execute([$publicId,$ownerId,$prospect['id'],$version,$score['experience_gap_score'],$score['walkthrough_fit_score'],$score['commercial_fit_score'],$score['visual_property_score'],$score['contactability_score'],$score['penalty_score'],$score['final_score'],$score['priority'],$score['qualification_status'],prospecting_confidence($body),prospecting_text($body,'experience_gap_summary',10000),prospecting_text($body,'primary_marketing_problem',10000),prospecting_text($body,'cinematicflight_opportunity',10000),PROSPECTING_SCORING_RULE_VERSION]);
        $update=$pdo->prepare('update prospecting_prospects set status=? where owner_id=? and id=?');$update->execute([$score['qualification_status'],$ownerId,$prospect['id']]);
        $pdo->commit();
        return ['public_id'=>$publicId,'version'=>$version]+$score+['confidence'=>(float)$body['confidence'],'experience_gap_summary'=>$body['experience_gap_summary'],'primary_marketing_problem'=>$body['primary_marketing_problem'],'cinematicflight_opportunity'=>$body['cinematicflight_opportunity'],'scoring_rule_version'=>PROSPECTING_SCORING_RULE_VERSION];
    } catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
}

function prospecting_list_qualifications(PDO $pdo,int $ownerId,string $prospectPublicId):array
{
    $prospect=prospecting_find($pdo,'prospecting_prospects',$ownerId,$prospectPublicId);
    $query=$pdo->prepare('select public_id,version,experience_gap_score,walkthrough_fit_score,commercial_fit_score,visual_property_score,contactability_score,penalty_score,final_score,priority,qualification_status,confidence,experience_gap_summary,primary_marketing_problem,cinematicflight_opportunity,scoring_rule_version,created_at from prospecting_qualifications where owner_id=? and prospect_id=? order by version desc');
    $query->execute([$ownerId,$prospect['id']]);$rows=$query->fetchAll();
    foreach($rows as &$row){foreach(['version','experience_gap_score','walkthrough_fit_score','commercial_fit_score','visual_property_score','contactability_score','penalty_score','final_score'] as $field)$row[$field]=(int)$row[$field];$row['confidence']=(float)$row['confidence'];}unset($row);
    return $rows;
}

function prospecting_create_approval(PDO $pdo,int $ownerId,string $prospectPublicId,array $body):array
{
    prospecting_reject_unknown($body,['qualification_public_id','action','status','payload']);
    $action=prospecting_enum($body,'action',PROSPECTING_APPROVAL_ACTIONS);
    $status=prospecting_enum($body,'status',PROSPECTING_APPROVAL_STATUSES,false)??'PENDING';
    if(!array_key_exists('payload',$body)||(!is_array($body['payload'])&&!is_string($body['payload'])))throw new ProspectingError('payload is required for approval hashing.',422);
    $payloadJson=prospecting_json(prospecting_canonicalize($body['payload']));
    if(strlen($payloadJson)>30000)throw new ProspectingError('Approval payload is too large.',422);
    $pdo->beginTransaction();
    try {
        $prospect=prospecting_find($pdo,'prospecting_prospects',$ownerId,$prospectPublicId,true);
        $qualificationId=null;
        $qualificationPublic=prospecting_text($body,'qualification_public_id',80,false);
        if($qualificationPublic!==null){$qualification=prospecting_find($pdo,'prospecting_qualifications',$ownerId,$qualificationPublic);if((int)$qualification['prospect_id']!==(int)$prospect['id'])throw new ProspectingError('The qualification does not belong to this prospect.',422);$qualificationId=(int)$qualification['id'];}
        if(in_array($action,['APPROVE_PROSPECT','REJECT_PROSPECT','PROMOTE_TO_STUDIO'],true)&&$qualificationId===null)throw new ProspectingError('This approval action requires a qualification snapshot.',422);
        $nextStatus=null;
        if($status==='APPROVED'&&$action==='APPROVE_PROSPECT')$nextStatus='APPROVED';
        if($status==='APPROVED'&&$action==='REJECT_PROSPECT')$nextStatus='REJECTED';
        if($nextStatus!==null)prospecting_assert_transition(PROSPECTING_PROSPECT_TRANSITIONS,$prospect['status'],$nextStatus,'prospect');
        $resolved=in_array($status,['APPROVED','REJECTED','CANCELLED'],true);
        $publicId=prospecting_public_id('approval');
        $statement=$pdo->prepare('insert into prospecting_approvals(public_id,owner_id,prospect_id,qualification_id,action,status,payload_hash,approved_by_owner_id,resolved_at) values(?,?,?,?,?,?,?,?,?)');
        $statement->execute([$publicId,$ownerId,$prospect['id'],$qualificationId,$action,$status,hash('sha256',$payloadJson),$resolved?$ownerId:null,$resolved?gmdate('Y-m-d H:i:s'):null]);
        if($nextStatus!==null){$update=$pdo->prepare('update prospecting_prospects set status=? where owner_id=? and id=?');$update->execute([$nextStatus,$ownerId,$prospect['id']]);}
        $pdo->commit();
        return ['public_id'=>$publicId,'qualification_public_id'=>$qualificationPublic,'action'=>$action,'status'=>$status,'payload_hash'=>hash('sha256',$payloadJson),'approved_by_owner_id'=>$resolved?$ownerId:null,'resolved_at'=>$resolved?gmdate('Y-m-d H:i:s'):null,'external_execution_available'=>false];
    }catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
}

function prospecting_list_approvals(PDO $pdo,int $ownerId,string $prospectPublicId):array
{
    $prospect=prospecting_find($pdo,'prospecting_prospects',$ownerId,$prospectPublicId);
    $query=$pdo->prepare('select a.public_id,q.public_id as qualification_public_id,a.action,a.status,a.payload_hash,a.approved_by_owner_id,a.created_at,a.resolved_at from prospecting_approvals a left join prospecting_qualifications q on q.id=a.qualification_id and q.owner_id=a.owner_id where a.owner_id=? and a.prospect_id=? order by a.id');
    $query->execute([$ownerId,$prospect['id']]);$rows=$query->fetchAll();foreach($rows as &$row)$row['approved_by_owner_id']=$row['approved_by_owner_id']===null?null:(int)$row['approved_by_owner_id'];unset($row);return $rows;
}

function prospecting_create_cost(PDO $pdo,int $ownerId,array $body):array
{
    prospecting_reject_unknown($body,['mission_public_id','prospect_public_id','agent_run_public_id','provider','operation','estimated_cost_centavos','actual_cost_centavos','idempotency_key']);
    $missionPublic=prospecting_text($body,'mission_public_id',80,false);$missionId=null;
    if($missionPublic!==null){$mission=prospecting_find($pdo,'prospecting_missions',$ownerId,$missionPublic);$missionId=(int)$mission['id'];}
    $prospectPublic=prospecting_text($body,'prospect_public_id',80,false);$prospectId=null;
    if($prospectPublic!==null){$prospect=prospecting_find($pdo,'prospecting_prospects',$ownerId,$prospectPublic);$prospectId=(int)$prospect['id'];}
    $runPublic=prospecting_text($body,'agent_run_public_id',80,false);$runId=null;
    if($runPublic!==null){$run=prospecting_find($pdo,'prospecting_agent_runs',$ownerId,$runPublic);$runId=(int)$run['id'];}
    $provider=prospecting_text($body,'provider',120);$operation=prospecting_text($body,'operation',120);
    $estimated=prospecting_integer($body,'estimated_cost_centavos',0);
    $actual=prospecting_integer($body,'actual_cost_centavos',0,null,false);
    $key=prospecting_text($body,'idempotency_key',190);
    if(!preg_match('/^[A-Za-z0-9][A-Za-z0-9._:-]{7,189}$/D',$key))throw new ProspectingError('Invalid idempotency_key.',422);
    $pdo->beginTransaction();
    try{
        // Serialize browser-recorded costs with internal monthly reservations.
        $owner=$pdo->prepare('select id from studio_users where id=? for update');$owner->execute([$ownerId]);if(!$owner->fetch())throw new ProspectingError('Owner not found.',401);
        $existing=$pdo->prepare('select * from prospecting_cost_events where owner_id=? and idempotency_key=? limit 1 for update');$existing->execute([$ownerId,$key]);$row=$existing->fetch();
        if($row){
            $same=(int)($row['mission_id']??0)===(int)($missionId??0)&&(int)($row['prospect_id']??0)===(int)($prospectId??0)&&(int)($row['agent_run_id']??0)===(int)($runId??0)&&$row['provider']===$provider&&$row['operation']===$operation&&(int)$row['estimated_cost_centavos']===$estimated&&($row['actual_cost_centavos']===null?$actual===null:(int)$row['actual_cost_centavos']===$actual);
            if(!$same)throw new ProspectingError('The idempotency key is already bound to a different cost event.',409);
            $result=prospecting_cost_row($row,true);$pdo->commit();return $result;
        }
        $publicId=prospecting_public_id('cost-event');$statement=$pdo->prepare('insert into prospecting_cost_events(public_id,owner_id,mission_id,prospect_id,agent_run_id,provider,operation,estimated_cost_centavos,actual_cost_centavos,idempotency_key) values(?,?,?,?,?,?,?,?,?,?)');$statement->execute([$publicId,$ownerId,$missionId,$prospectId,$runId,$provider,$operation,$estimated,$actual,$key]);
        $existing=$pdo->prepare('select * from prospecting_cost_events where owner_id=? and public_id=?');$existing->execute([$ownerId,$publicId]);$result=prospecting_cost_row($existing->fetch(),false);$pdo->commit();return $result;
    }catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();if($error instanceof PDOException&&$error->getCode()==='23000')throw new ProspectingError('The idempotency key is already in use.',409);throw $error;}
}

function prospecting_cost_row(array $row,bool $duplicate):array
{
    return ['public_id'=>$row['public_id'],'provider'=>$row['provider'],'operation'=>$row['operation'],'estimated_cost_centavos'=>(int)$row['estimated_cost_centavos'],'actual_cost_centavos'=>$row['actual_cost_centavos']===null?null:(int)$row['actual_cost_centavos'],'idempotency_key'=>$row['idempotency_key'],'created_at'=>$row['created_at'],'duplicate'=>$duplicate];
}

function prospecting_cost_summary(PDO $pdo,int $ownerId,string $missionPublicId):array
{
    $mission=prospecting_find($pdo,'prospecting_missions',$ownerId,$missionPublicId);
    $query=$pdo->prepare('select coalesce(sum(estimated_cost_centavos),0) estimated,coalesce(sum(actual_cost_centavos),0) actual from prospecting_cost_events where owner_id=? and mission_id=?');$query->execute([$ownerId,$mission['id']]);$cost=$query->fetch();
    $budget=(int)$mission['mission_budget_centavos'];$actual=(int)$cost['actual'];
    return ['mission_public_id'=>$missionPublicId,'mission_budget_centavos'=>$budget,'estimated_cost_centavos'=>(int)$cost['estimated'],'actual_cost_centavos'=>$actual,'remaining_budget_centavos'=>max(0,$budget-$actual)];
}

function prospecting_read_runs(PDO $pdo,int $ownerId):array
{
    $params=[$ownerId];$where='r.owner_id=?';
    if(isset($_GET['id'])){$where.=' and r.public_id=?';$params[]=prospecting_query_public_id('id','agent-run');}
    if(isset($_GET['prospect_id'])){$prospect=prospecting_find($pdo,'prospecting_prospects',$ownerId,prospecting_query_public_id('prospect_id','prospect'));$where.=' and r.prospect_id=?';$params[]=$prospect['id'];}
    if(isset($_GET['mission_id'])){$mission=prospecting_find($pdo,'prospecting_missions',$ownerId,prospecting_query_public_id('mission_id','mission'));$where.=' and r.mission_id=?';$params[]=$mission['id'];}
    $query=$pdo->prepare("select r.public_id,m.public_id mission_public_id,p.public_id prospect_public_id,r.status,r.started_at,r.completed_at,r.stop_reason,r.step_count,r.llm_call_count,r.research_duration_ms,r.created_at,r.updated_at from prospecting_agent_runs r left join prospecting_missions m on m.id=r.mission_id and m.owner_id=r.owner_id join prospecting_prospects p on p.id=r.prospect_id and p.owner_id=r.owner_id where {$where} order by r.id desc");$query->execute($params);$rows=$query->fetchAll();
    foreach($rows as &$row){$row['mission_id']=$row['mission_public_id'];$row['prospect_id']=$row['prospect_public_id'];unset($row['mission_public_id'],$row['prospect_public_id']);foreach(['step_count','llm_call_count','research_duration_ms'] as $field)$row[$field]=(int)$row[$field];}unset($row);return $rows;
}

function prospecting_read_decisions(PDO $pdo,int $ownerId,string $runPublicId):array
{
    $run=prospecting_find($pdo,'prospecting_agent_runs',$ownerId,$runPublicId);
    $query=$pdo->prepare('select public_id,step_number,action,reason,target,expected_information,authority_result,budget_result,estimated_cost_centavos,actual_cost_centavos,confidence,state_before_json,state_after_json,governance_trace_json,created_at from prospecting_agent_decisions where owner_id=? and agent_run_id=? order by step_number');$query->execute([$ownerId,$run['id']]);$rows=$query->fetchAll();
    foreach($rows as &$row){foreach(['step_number','estimated_cost_centavos'] as $field)$row[$field]=(int)$row[$field];$row['actual_cost_centavos']=$row['actual_cost_centavos']===null?null:(int)$row['actual_cost_centavos'];$row['confidence']=(float)$row['confidence'];foreach(['state_before','state_after','governance_trace'] as $field){$row[$field]=json_decode($row[$field.'_json'],true,128,JSON_THROW_ON_ERROR);unset($row[$field.'_json']);}}unset($row);return $rows;
}

function prospecting_read_artifacts(PDO $pdo,int $ownerId,string $prospectPublicId):array
{
    $prospect=prospecting_find($pdo,'prospecting_prospects',$ownerId,$prospectPublicId);$params=[$ownerId,$prospect['id']];$where='a.owner_id=? and a.prospect_id=?';
    if(isset($_GET['id'])){$where.=' and a.public_id=?';$params[]=prospecting_query_public_id('id','artifact');}
    if(isset($_GET['type'])){$type=(string)$_GET['type'];if(!in_array($type,['WALKTHROUGH_CONCEPT','OUTREACH_DRAFT'],true))throw new ProspectingError('Invalid artifact type.',422);$where.=' and a.type=?';$params[]=$type;}
    if(isset($_GET['version'])){$version=filter_var($_GET['version'],FILTER_VALIDATE_INT,['options'=>['min_range'=>1]]);if($version===false)throw new ProspectingError('Invalid artifact version.',422);$where.=' and a.version=?';$params[]=$version;}
    $query=$pdo->prepare("select a.public_id,q.public_id qualification_public_id,a.type,a.version,a.content,a.created_at from prospecting_artifacts a left join prospecting_qualifications q on q.id=a.qualification_id and q.owner_id=a.owner_id where {$where} order by a.type,a.version desc");$query->execute($params);$rows=$query->fetchAll();
    foreach($rows as &$row){$content=json_decode($row['content'],true,128,JSON_THROW_ON_ERROR);$row['content']=$content['value'];$row['version']=(int)$row['version'];$row['delivery_status']='INTERNAL_UNSENT';}unset($row);return $rows;
}

function prospecting_read_reservations(PDO $pdo,int $ownerId):array
{
    $params=[$ownerId];$where='r.owner_id=?';
    if(isset($_GET['id'])){$where.=' and r.public_id=?';$params[]=prospecting_query_public_id('id','reservation');}
    if(isset($_GET['mission_id'])){$mission=prospecting_find($pdo,'prospecting_missions',$ownerId,prospecting_query_public_id('mission_id','mission'));$where.=' and r.mission_id=?';$params[]=$mission['id'];}
    $query=$pdo->prepare("select r.public_id,m.public_id mission_public_id,p.public_id prospect_public_id,ar.public_id run_public_id,r.provider,r.operation,r.estimated_cost_centavos,r.reserved_cost_centavos,r.actual_cost_centavos,case when r.status='RESERVED' and r.expires_at<=utc_timestamp() then 'EXPIRED' else r.status end status,r.idempotency_key,r.expires_at,r.created_at,r.updated_at,r.committed_at,r.released_at from prospecting_budget_reservations r join prospecting_missions m on m.id=r.mission_id and m.owner_id=r.owner_id left join prospecting_prospects p on p.id=r.prospect_id and p.owner_id=r.owner_id left join prospecting_agent_runs ar on ar.id=r.agent_run_id and ar.owner_id=r.owner_id where {$where} order by r.id desc");$query->execute($params);$rows=$query->fetchAll();foreach($rows as &$row){foreach(['estimated_cost_centavos','reserved_cost_centavos'] as $field)$row[$field]=(int)$row[$field];$row['actual_cost_centavos']=$row['actual_cost_centavos']===null?null:(int)$row['actual_cost_centavos'];}unset($row);return $rows;
}

function prospecting_read_website_research(PDO $pdo,int $ownerId):array
{
    $params=[$ownerId];$where='wr.owner_id=?';
    if(isset($_GET['id'])){$where.=' and wr.public_id=?';$params[]=prospecting_query_public_id('id','website-research');}
    if(isset($_GET['prospect_id'])){$prospect=prospecting_find($pdo,'prospecting_prospects',$ownerId,prospecting_query_public_id('prospect_id','prospect'));$where.=' and wr.prospect_id=?';$params[]=$prospect['id'];}
    $query=$pdo->prepare("select wr.public_id,m.public_id mission_public_id,p.public_id prospect_public_id,ar.public_id run_public_id,wr.status,wr.requested_url,wr.canonical_host,wr.pages_attempted,wr.pages_succeeded,wr.stop_reason,wr.started_at,wr.completed_at,wr.created_at,wr.updated_at from prospecting_website_research wr join prospecting_missions m on m.id=wr.mission_id and m.owner_id=wr.owner_id join prospecting_prospects p on p.id=wr.prospect_id and p.owner_id=wr.owner_id join prospecting_agent_runs ar on ar.id=wr.agent_run_id and ar.owner_id=wr.owner_id where {$where} order by wr.id desc");$query->execute($params);$rows=$query->fetchAll();
    foreach($rows as &$row){$row['mission_id']=$row['mission_public_id'];$row['prospect_id']=$row['prospect_public_id'];$row['agent_run_id']=$row['run_public_id'];unset($row['mission_public_id'],$row['prospect_public_id'],$row['run_public_id']);foreach(['pages_attempted','pages_succeeded'] as $field)$row[$field]=(int)$row[$field];}unset($row);return $rows;
}

function prospecting_request_row(array $row):array
{
    return ['public_id'=>$row['public_id'],'mission_id'=>$row['mission_public_id'],'prospect_id'=>$row['prospect_public_id'],'requested_url'=>$row['requested_url'],'normalized_domain'=>$row['normalized_domain'],'status'=>$row['status'],'agent_run_id'=>$row['run_public_id'],'website_research_id'=>$row['research_public_id'],'owner_note'=>$row['owner_note'],'requested_at'=>$row['requested_at'],'claimed_at'=>$row['claimed_at'],'completed_at'=>$row['completed_at'],'cancelled_at'=>$row['cancelled_at'],'created_at'=>$row['created_at'],'updated_at'=>$row['updated_at']];
}

function prospecting_read_website_research_requests(PDO $pdo,int $ownerId):array
{
    $params=[$ownerId];$where='r.owner_id=?';
    if(isset($_GET['id'])){$where.=' and r.public_id=?';$params[]=prospecting_query_public_id('id','website-research-request');}
    if(isset($_GET['prospect_id'])){$prospect=prospecting_find($pdo,'prospecting_prospects',$ownerId,prospecting_query_public_id('prospect_id','prospect'));$where.=' and r.prospect_id=?';$params[]=$prospect['id'];}
    if(isset($_GET['mission_id'])){$mission=prospecting_find($pdo,'prospecting_missions',$ownerId,prospecting_query_public_id('mission_id','mission'));$where.=' and r.mission_id=?';$params[]=$mission['id'];}
    $sql="select r.*,m.public_id mission_public_id,p.public_id prospect_public_id,ar.public_id run_public_id,wr.public_id research_public_id from prospecting_website_research_requests r join prospecting_missions m on m.id=r.mission_id and m.owner_id=r.owner_id join prospecting_prospects p on p.id=r.prospect_id and p.owner_id=r.owner_id left join prospecting_agent_runs ar on ar.id=r.agent_run_id left join prospecting_website_research wr on wr.id=r.website_research_id where {$where} order by r.id desc";$query=$pdo->prepare($sql);$query->execute($params);return array_map('prospecting_request_row',$query->fetchAll());
}

function prospecting_create_website_research_request(PDO $pdo,int $ownerId,array $body):array
{
    prospecting_reject_unknown($body,['mission_public_id','prospect_public_id','idempotency_key','owner_note']);$missionId=prospecting_text($body,'mission_public_id',80);$prospectId=prospecting_text($body,'prospect_public_id',80);$key=prospecting_text($body,'idempotency_key',190);$note=prospecting_text($body,'owner_note',500,false);$mission=prospecting_find($pdo,'prospecting_missions',$ownerId,$missionId,true);$prospect=prospecting_find($pdo,'prospecting_prospects',$ownerId,$prospectId,true);
    if($mission['status']!=='RUNNING'||$prospect['status']!=='RESEARCHING')throw new ProspectingError('Research requests require a running mission and researching prospect.',409);
    if(!$prospect['website']||!$prospect['normalized_domain']||!str_starts_with(strtolower($prospect['website']),'https://'))throw new ProspectingError('Research requests require the prospect\'s recorded official HTTPS website.',422);
    $member=$pdo->prepare('select 1 from prospecting_mission_prospects where mission_id=? and prospect_id=?');$member->execute([$mission['id'],$prospect['id']]);if(!$member->fetchColumn())throw new ProspectingError('The prospect must belong to this mission.',422);
    $payload=['mission_public_id'=>$missionId,'prospect_public_id'=>$prospectId,'owner_note'=>$note];$hash=hash('sha256',prospecting_json(prospecting_canonicalize($payload)));$existing=$pdo->prepare('select *,? mission_public_id,? prospect_public_id,null run_public_id,null research_public_id from prospecting_website_research_requests where owner_id=? and idempotency_key=?');$existing->execute([$missionId,$prospectId,$ownerId,$key]);$row=$existing->fetch();if($row){if(!hash_equals($row['request_hash'],$hash))throw new ProspectingError('Research request idempotency key conflicts with a different request.',409);return prospecting_request_row($row);}
    $active=$pdo->prepare("select 1 from prospecting_website_research_requests where owner_id=? and mission_id=? and prospect_id=? and status in ('PENDING','CLAIMED') limit 1");$active->execute([$ownerId,$mission['id'],$prospect['id']]);if($active->fetchColumn())throw new ProspectingError('An active website research request already exists for this prospect and mission.',409);
    $public=prospecting_public_id('website-research-request');$insert=$pdo->prepare("insert into prospecting_website_research_requests(public_id,owner_id,mission_id,prospect_id,requested_url,normalized_domain,status,idempotency_key,request_hash,owner_note) values(?,?,?,?,?,?, 'PENDING',?,?,?)");$insert->execute([$public,$ownerId,$mission['id'],$prospect['id'],$prospect['website'],$prospect['normalized_domain'],$key,$hash,$note]);$_GET['id']=$public;return prospecting_read_website_research_requests($pdo,$ownerId)[0];
}

function prospecting_cancel_website_research_request(PDO $pdo,int $ownerId,string $publicId,array $body):array
{
    prospecting_reject_unknown($body,['status']);if(prospecting_enum($body,'status',['CANCELLED'])!=='CANCELLED')throw new ProspectingError('Only pending requests can be cancelled.',422);$query=$pdo->prepare('select * from prospecting_website_research_requests where owner_id=? and public_id=? for update');$query->execute([$ownerId,$publicId]);$row=$query->fetch();if(!$row)throw new ProspectingError('The requested resource could not be found.',404);if($row['status']!=='PENDING')throw new ProspectingError('Only pending research requests can be cancelled.',409);$pdo->prepare("update prospecting_website_research_requests set status='CANCELLED',cancelled_at=utc_timestamp() where id=?")->execute([$row['id']]);$_GET['id']=$publicId;return prospecting_read_website_research_requests($pdo,$ownerId)[0];
}

function prospecting_route(PDO $pdo,int $ownerId,string $action):void
{
    $method=$_SERVER['REQUEST_METHOD'];
    try {
        $pdo->exec("set time_zone='+00:00'");
        $write=in_array($method,['POST','PATCH','PUT','DELETE'],true);
        if($write)require_csrf();
        $body=$write?prospecting_request_body():[];
        if($action==='prospecting-missions'){
            if($method==='GET'){
                if(isset($_GET['id']))respond(['mission'=>prospecting_mission_row(prospecting_find($pdo,'prospecting_missions',$ownerId,prospecting_query_public_id('id','mission'))),'csrfToken'=>csrf_token()]);
                $query=$pdo->prepare('select * from prospecting_missions where owner_id=? order by created_at desc,id desc');$query->execute([$ownerId]);respond(['data'=>array_map('prospecting_mission_row',$query->fetchAll()),'csrfToken'=>csrf_token()]);
            }
            if($method==='POST')respond(['mission'=>prospecting_create_mission($pdo,$ownerId,$body)],201);
            if($method==='PATCH')respond(['mission'=>prospecting_patch_mission($pdo,$ownerId,prospecting_query_public_id('id','mission'),$body)]);
        }
        if($action==='prospecting-prospects'){
            if($method==='GET'){
                if(isset($_GET['id']))respond(['prospect'=>prospecting_prospect_row(prospecting_find($pdo,'prospecting_prospects',$ownerId,prospecting_query_public_id('id','prospect'))),'csrfToken'=>csrf_token()]);
                $query=$pdo->prepare('select * from prospecting_prospects where owner_id=? order by created_at desc,id desc');$query->execute([$ownerId]);respond(['data'=>array_map('prospecting_prospect_row',$query->fetchAll()),'csrfToken'=>csrf_token()]);
            }
            if($method==='POST')respond(['prospect'=>prospecting_create_prospect($pdo,$ownerId,$body)],201);
            if($method==='PATCH')respond(['prospect'=>prospecting_patch_prospect($pdo,$ownerId,prospecting_query_public_id('id','prospect'),$body)]);
        }
        if($action==='prospecting-mission-prospects'){
            $missionId=prospecting_query_public_id('mission_id','mission');
            if($method==='GET')respond(['data'=>prospecting_list_memberships($pdo,$ownerId,$missionId),'csrfToken'=>csrf_token()]);
            if($method==='POST')respond(prospecting_membership($pdo,$ownerId,$missionId,$body));
        }
        if(in_array($action,['prospecting-evidence','prospecting-contacts','prospecting-qualifications','prospecting-approvals'],true)){
            $prospectId=prospecting_query_public_id('prospect_id','prospect');
            if($action==='prospecting-evidence'){if($method==='GET')respond(['data'=>prospecting_list_evidence($pdo,$ownerId,$prospectId),'csrfToken'=>csrf_token()]);if($method==='POST')respond(['evidence'=>prospecting_create_evidence($pdo,$ownerId,$prospectId,$body)],201);}
            if($action==='prospecting-contacts'){if($method==='GET')respond(['data'=>prospecting_list_contacts($pdo,$ownerId,$prospectId),'csrfToken'=>csrf_token()]);if($method==='POST')respond(['contact'=>prospecting_create_contact($pdo,$ownerId,$prospectId,$body)],201);}
            if($action==='prospecting-qualifications'){if($method==='GET')respond(['data'=>prospecting_list_qualifications($pdo,$ownerId,$prospectId),'csrfToken'=>csrf_token()]);if($method==='POST')respond(['qualification'=>prospecting_create_qualification($pdo,$ownerId,$prospectId,$body)],201);}
            if($action==='prospecting-approvals'){if($method==='GET')respond(['data'=>prospecting_list_approvals($pdo,$ownerId,$prospectId),'csrfToken'=>csrf_token()]);if($method==='POST')respond(['approval'=>prospecting_create_approval($pdo,$ownerId,$prospectId,$body)],201);}
        }
        if($action==='prospecting-cost-events'&&$method==='POST')respond(['cost_event'=>prospecting_create_cost($pdo,$ownerId,$body)],201);
        if($action==='prospecting-costs'&&$method==='GET')respond(['summary'=>prospecting_cost_summary($pdo,$ownerId,prospecting_query_public_id('mission_id','mission')),'csrfToken'=>csrf_token()]);
        if($action==='prospecting-runs'&&$method==='GET')respond(['data'=>prospecting_read_runs($pdo,$ownerId),'csrfToken'=>csrf_token()]);
        if($action==='prospecting-decisions'&&$method==='GET')respond(['data'=>prospecting_read_decisions($pdo,$ownerId,prospecting_query_public_id('run_id','agent-run')),'csrfToken'=>csrf_token()]);
        if($action==='prospecting-artifacts'&&$method==='GET')respond(['data'=>prospecting_read_artifacts($pdo,$ownerId,prospecting_query_public_id('prospect_id','prospect')),'csrfToken'=>csrf_token()]);
        if($action==='prospecting-reservations'&&$method==='GET')respond(['data'=>prospecting_read_reservations($pdo,$ownerId),'csrfToken'=>csrf_token()]);
        if($action==='prospecting-website-research'&&$method==='GET')respond(['data'=>prospecting_read_website_research($pdo,$ownerId),'csrfToken'=>csrf_token()]);
        if($action==='prospecting-website-research-requests'){
            if($method==='GET')respond(['data'=>prospecting_read_website_research_requests($pdo,$ownerId),'csrfToken'=>csrf_token()]);
            if($method==='POST')respond(['request'=>prospecting_create_website_research_request($pdo,$ownerId,$body)],201);
            if($method==='PATCH')respond(['request'=>prospecting_cancel_website_research_request($pdo,$ownerId,prospecting_query_public_id('id','website-research-request'),$body)]);
        }
        respond(['error'=>'Method not allowed.'],405);
    } catch(ProspectingError $error){respond(['error'=>$error->getMessage()],$error->getCode());}
    catch(Throwable $error){error_log('Studio prospecting API failed: '.get_class($error));respond(['error'=>'Prospecting storage is temporarily unavailable. No fallback was used.'],503);}
}
