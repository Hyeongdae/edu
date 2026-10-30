import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import test from "node:test";

const shell = process.platform === "win32" ? "powershell.exe" : "pwsh";
const literal = (value) => "'" + value.replaceAll("'", "''") + "'";
const modulePath = resolve("deploy/DeploymentPlan.psm1");
const scriptPath = resolve("deploy/Deploy-DexEscape.ps1");
const ids = { subscription: "11111111-2222-4333-8444-555555555555", tenant: "22222222-3333-4444-8555-666666666666", client: "33333333-4444-4555-8666-777777777777" };
function powershell(code) {
  const prefix = `$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; [Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); Import-Module ${literal(modulePath)} -Force -DisableNameChecking; `;
  const wrapped = prefix + "try { " + code + " } catch { [Console]::Error.WriteLine($_.Exception.Message); [Console]::Error.WriteLine($_.ScriptStackTrace); exit 1 }";
  const result = spawnSync(shell, ["-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(wrapped, "utf16le").toString("base64")],
    { encoding: "utf8", windowsHide: true, timeout: 30000, maxBuffer: 2 * 1024 * 1024 });
  assert.equal(result.error, undefined, "PowerShell must be available for deployment verification.");
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}
const plan = `$plan=Get-DeploymentPlan -SubscriptionId '${ids.subscription}' -TenantId '${ids.tenant}' -ClientId '${ids.client}'; `;

test("builds deterministic legal dedicated names and explicitly chooses Standard", () => {
  const result = powershell(plan + '$plan.Target | ConvertTo-Json -Depth 5');
  assert.equal(result.sku, "Standard"); assert.equal(result.repository, "Hyeongdae/edu");
  assert.match(result.storageAccountName, /^[a-z0-9]{3,24}$/);
  assert.equal(result.staticSiteName, powershell(plan + '$plan.Target | ConvertTo-Json -Depth 5').staticSiteName);
});

test("rejects invalid target names, identifiers and repositories", () => {
  const result = powershell(`$passed=0; foreach($parameters in @(@{TenantId='common'},@{StorageName='Invalid-Storage'},@{StaticSiteName='x;command'},@{Repository='other/repo'})) {
    try { $null=Get-DeploymentPlan @parameters; throw 'Accepted invalid input' } catch { if($_.Exception.Message -eq 'Accepted invalid input'){throw}; $passed++ }
  }; @{rejected=$passed}|ConvertTo-Json`);
  assert.equal(result.rejected, 4);
});

test("preserves existing web callbacks and deduplicates the exact HTTPS production callback", () => {
  const result = powershell(`$callback='https://fixture.azurestaticapps.net/.auth/login/aad/callback';
    $next=@(Merge-EntraWebRedirects -Existing @('http://localhost:5173/','https://other.example/callback',$callback) -Callback $callback);
    @{uris=$next}|ConvertTo-Json`);
  assert.deepEqual(result.uris, ["http://localhost:5173/", "https://other.example/callback", "https://fixture.azurestaticapps.net/.auth/login/aad/callback"]);
});

test("binds recovery metadata to subscription tenant and app, but allows a read-only preview without IDs", () => {
  const result = powershell(plan + `
    $saved=$plan.Target; $preview=Get-DeploymentPlan -SavedManifest $saved; $rejected=0;
    try{$null=Get-DeploymentPlan -SubscriptionId '99999999-2222-4333-8444-555555555555' -TenantId '${ids.tenant}' -ClientId '${ids.client}' -SavedManifest $saved}catch{$rejected++};
    @{rejected=$rejected;previewName=$preview.Target.staticSiteName;originalName=$saved.staticSiteName;ready=$preview.IdentityConfigured}|ConvertTo-Json`);
  assert.equal(result.rejected, 1); assert.equal(result.ready, false); assert.equal(result.previewName, result.originalName);
});

test("rejects foreign, insecure and ambiguous callback destinations", () => {
  const result = powershell(`$passed=0; foreach($url in @('http://fixture.azurestaticapps.net/.auth/login/aad/callback','https://evil.example/.auth/login/aad/callback','https://fixture.azurestaticapps.net/wrong','https://fixture.azurestaticapps.net/.auth/login/aad/callback?token=x')) {
    try { $null=Merge-EntraWebRedirects -Callback $url; throw 'Accepted bad callback' } catch { if($_.Exception.Message -eq 'Accepted bad callback'){throw}; $passed++ }
  }; @{rejected=$passed}|ConvertTo-Json`);
  assert.equal(result.rejected, 4);
});

test("requires saved ownership tags and rejects secret-bearing manifest fields", () => {
  const result = powershell(plan + `
    $resource=[pscustomobject]@{name=$plan.Target.staticSiteName;tags=$plan.Tags}; Assert-DexOwnedResource $resource $resource.name $plan.Tags;
    $rejected=0; try{Assert-DexOwnedResource ([pscustomobject]@{name=$resource.name;tags=@{}}) $resource.name $plan.Tags}catch{$rejected++};
    $plan.Target['clientSecret']='fixture-only'; try{Assert-DexManifest $plan.Target -AllowIncomplete}catch{$rejected++};
    @{rejected=$rejected}|ConvertTo-Json`);
  assert.equal(result.rejected, 2);
});

test("defaults to PlanOnly with zero native/cloud calls even when identifiers are ready", () => {
  const result = powershell(`$output=& ${literal(scriptPath)} -SubscriptionId '${ids.subscription}' -TenantId '${ids.tenant}' -ClientId '${ids.client}'
    -ManifestPath (Join-Path ([IO.Path]::GetTempPath()) ([guid]::NewGuid().ToString()+'.json'))
    -StatePath (Join-Path ([IO.Path]::GetTempPath()) ([guid]::NewGuid().ToString()+'.json'))
    -ToolRunner { throw 'A plan invoked a native tool' }; $output | ConvertFrom-Json | ConvertTo-Json`.replaceAll(/\n\s+-/g, " -"));
  assert.equal(result.mode, "PlanOnly"); assert.equal(result.cloudWrites, false);
  assert.equal(result.identityConfigured, true); assert.equal(result.sku, "Standard");
  assert.ok(!JSON.stringify(result).includes(ids.client));
});

test("pre-created resource group mode keeps planning read-only and reports the scoped path", () => {
  const result = powershell(`$output=& ${literal(scriptPath)} -UseExistingResourceGroup -SubscriptionId '${ids.subscription}' -TenantId '${ids.tenant}' -ClientId '${ids.client}' -ToolRunner { throw 'Plan invoked a tool' }; $output|ConvertFrom-Json|ConvertTo-Json`);
  assert.equal(result.mode, "PlanOnly"); assert.equal(result.cloudWrites, false); assert.equal(result.useExistingResourceGroup, true);
});

test("rejects missing Azure permissions before any GitHub operation, state file or resource write", () => {
  const result = powershell(`
    $state=@{calls=0;denied=$false};
    $fake={param($Tool,$Arguments,$InputText)
      $state.calls++;
      if($state.calls -eq 1 -and $Arguments[0] -eq 'account'){return @{id='${ids.subscription}';tenantId='${ids.tenant}';state='Enabled'}}
      if($state.calls -eq 2 -and $Arguments[0] -eq 'rest' -and $Arguments -contains 'get'){return @{value=@()}}
      throw 'Unexpected operation after permission rejection'
    }.GetNewClosure();
    $path=Join-Path ([IO.Path]::GetTempPath()) ([guid]::NewGuid().ToString()+'.json');
    try { & ${literal(scriptPath)} -Apply -SubscriptionId '${ids.subscription}' -TenantId '${ids.tenant}' -ClientId '${ids.client}' -AzureCliPath fake-az -GhPath fake-gh -ToolRunner $fake -ManifestPath $path -StatePath $path }
    catch { if($_.Exception.Message -notmatch 'deployment permissions are missing'){throw}; $state.denied=$true };
    @{denied=$state.denied;calls=$state.calls;fileCreated=(Test-Path -LiteralPath $path)}|ConvertTo-Json`);
  assert.equal(result.denied, true); assert.equal(result.calls, 2); assert.equal(result.fileCreated, false);
});

test("permission preflight accepts scoped Contributor wildcards and rejects exclusions", () => {
  const result = powershell(`
    Assert-DexDeploymentPermissions -Permissions @{value=@(@{actions=@('*');notActions=@('Microsoft.Authorization/*/Write','Microsoft.Authorization/*/Delete')})} -NeedResourceGroupCreation;
    Assert-DexDeploymentPermissions -Permissions @{value=@(@{actions=@('Microsoft.Web/staticSites/*','Microsoft.Storage/storageAccounts/*','Microsoft.Resources/subscriptions/resourceGroups/read');notActions=@()})};
    Assert-DexDeploymentPermissions -Permissions @{value=@(@{actions=@('*/read','*/write','Microsoft.Web/staticSites/listappsettings/action','Microsoft.Web/staticSites/listsecrets/action','Microsoft.Storage/storageAccounts/listKeys/action');notActions=@('*/delete')})} -NeedResourceGroupCreation;
    $rejected=0;
    try { Assert-DexDeploymentPermissions -Permissions @{value=@(@{actions=@('*');notActions=@('Microsoft.Storage/storageAccounts/listKeys/action')})} } catch {$rejected++};
    try { Assert-DexDeploymentPermissions -Permissions @{value=@(@{actions=@('*/read');notActions=@()})} -NeedResourceGroupCreation } catch {$rejected++};
    @{rejected=$rejected}|ConvertTo-Json`);
  assert.equal(result.rejected, 2);
});

test("mock Apply is additive, secret-safe and reuses resources and credentials on rerun", async (t) => {
  const base = await realpath(tmpdir());
  const folder = await mkdtemp(join(base, "dex-provision-fixture-"));
  t.after(async () => { const path = await realpath(folder); assert.equal(dirname(path), base); assert.ok(basename(path).startsWith("dex-provision-fixture-")); await rm(path, { recursive: true }); });
  const manifestPath = join(folder, "manifest.json"), statePath = join(folder, "state.json");
  const result = powershell(plan + `
    $state=@{group=$false;site=$false;storage=$false;table=$false;creates=0;passwords=@(); settings=@{UNRELATED='keep'};
      web=@{redirectUris=@('https://other.example/callback');homePageUrl='https://other.example/'};stdinOnly=$false; patchSafe=$false};
    $fake={param($Tool,$Arguments,$InputText)
      $a=$Arguments; $operation=($a[0..([Math]::Min(2,$a.Length-1))] -join ' ');
      if($Tool -eq 'fake-gh') {
        if($a[0] -eq 'api' -and $a[1] -eq 'repos/Hyeongdae/edu'){return [pscustomobject]@{full_name='Hyeongdae/edu';permissions=@{push=$true}}}
        if($a[0] -eq 'api'){return @{key='public-key'}}
        if($a[0] -eq 'secret'){if($InputText -cne 'fixture-deployment-token' -or $a -contains 'fixture-deployment-token'){throw 'Unsafe deployment credential transfer'}; $state.stdinOnly=$true; return}
        if($a[0] -eq 'variable'){return}
        throw 'Unexpected GitHub fixture operation'
      }
      if($Tool -ne 'fake-az'){throw 'Unexpected tool'}
      switch -Wildcard ($operation) {
        'account show*' {return @{id='${ids.subscription}';tenantId='${ids.tenant}';state='Enabled'}}
        'ad app show' {return @{appId='${ids.client}';id='44444444-5555-4666-8777-888888888888';signInAudience='AzureADMyOrg';web=$state.web;
          spa=@{redirectUris=@('http://localhost:5173')};passwordCredentials=$state.passwords}}
        'ad signed-in-user show' {return @{id='operator'}}
        'ad sp show' {return @{appRoleAssignmentRequired=$false}}
        'ad app owner' {return @(@{id='operator'})}
        'provider show*' {return @{registrationState='Registered';resourceTypes=@(@{resourceType='staticSites';locations=@('East Asia')},@{resourceType='storageAccounts';locations=@('East Asia')})}}
        'group exists*' {return $state.group}
        'group show*' {$state.group=$true; return @{name=$plan.Target.resourceGroup;tags=$plan.Tags}}
        'resource list*' {return @()}
        'group create*' {$state.group=$true; $state.creates++; return @{name=$plan.Target.resourceGroup}}
        'staticwebapp list*' {if(-not $state.site){return}; return @{name=$plan.Target.staticSiteName;tags=$plan.Tags;sku=@{name='Standard'};defaultHostname='fixture.azurestaticapps.net'}}
        'staticwebapp create*' {if($a -notcontains 'Standard' -or $a -contains '--source'){throw 'Unexpected hosting mode'}; $state.site=$true; $state.creates++; return @{defaultHostname='fixture.azurestaticapps.net'}}
        'storage account list' {if(-not $state.storage){return}; return @{name=$plan.Target.storageAccountName;tags=$plan.Tags;allowBlobPublicAccess=$false;enableHttpsTrafficOnly=$true;minimumTlsVersion='TLS1_2';kind='StorageV2';sku=@{name='Standard_LRS'}}}
        'storage account create' {$state.storage=$true; $state.creates++; return @{name=$plan.Target.storageAccountName}}
        'storage account check-name' {return @{nameAvailable=(-not $state.storage)}}
        'storage account show-connection-string' {return @{connectionString='fixture-private-connection'}}
        'staticwebapp secrets list' {return @{properties=@{apiKey='fixture-deployment-token'}}}
        'rest *' {
          $url=$a[[array]::IndexOf($a,'--url')+1]; $method=$a[[array]::IndexOf($a,'--method')+1]; $body=$null;
          if($url.Contains('/Microsoft.Authorization/permissions?')){return @{value=@(@{actions=@('*');notActions=@()})}}
          if($a -contains '--body'){ $path=$a[[array]::IndexOf($a,'--body')+1]; if(-not $path.StartsWith('@')){throw 'JSON must be in private files'}; $body=ConvertFrom-Json ([IO.File]::ReadAllText($path.Substring(1))) }
          if($url.Contains('/tableServices/default/tables?')){return @{value=$(if($state.table){@(@{name='DexEscapePlayers'})}else{@()})}}
          if($url.Contains('/tables/DexEscapePlayers?')){$state.table=$true; $state.creates++; return @{}}
          if($method -eq 'patch'){if($body.PSObject.Properties.Name -contains 'spa' -or $body.PSObject.Properties.Name -contains 'passwordCredentials'){throw 'Unrelated app configuration changed'}; $state.web=ConvertTo-DexMap $body.web; $state.patchSafe=$true; return}
          if($url -match '/addPassword$'){$credential=@{keyId='55555555-6666-4777-8888-999999999999';endDateTime='2099-01-01T00:00:00Z'}; $state.passwords=@($credential); return @{keyId=$credential.keyId;endDateTime=$credential.endDateTime;secretText='fixture-private-app-secret'}}
          if($url.Contains('/listAppSettings?')){return @{properties=$state.settings}}
          if($url.Contains('/config/appsettings?')){$state.settings=ConvertTo-DexMap $body.properties; return @{}}
          throw 'Unexpected REST fixture operation'
        }
        default {throw 'Unexpected Azure fixture operation'}
      }
    }.GetNewClosure();
    $parameters=@{Apply=$true;SubscriptionId='${ids.subscription}';TenantId='${ids.tenant}';ClientId='${ids.client}';
      AzureCliPath='fake-az';GhPath='fake-gh';ToolRunner=$fake;ManifestPath=${literal(manifestPath)};StatePath=${literal(statePath)};UseExistingResourceGroup=$true};
    $null=& ${literal(scriptPath)} @parameters; $count=$state.creates; $null=& ${literal(scriptPath)} @parameters;
    if($state.settings.UNRELATED -cne 'keep' -or $state.web.homePageUrl -cne 'https://other.example/'){throw 'Unrelated configuration lost'};
    @{creates=$state.creates;firstCreates=$count;group=$state.group;site=$state.site;storage=$state.storage;table=$state.table;credentials=$state.passwords.Count;stdinOnly=$state.stdinOnly;patchSafe=$state.patchSafe;callbacks=@($state.web.redirectUris)}|ConvertTo-Json -Depth 5`);
  assert.equal(result.creates, 3, JSON.stringify(result)); assert.equal(result.firstCreates, 3); assert.equal(result.credentials, 1);
  assert.equal(result.stdinOnly, true); assert.equal(result.patchSafe, true);
  assert.deepEqual(result.callbacks, ["https://other.example/callback", "https://fixture.azurestaticapps.net/.auth/login/aad/callback"]);
  const manifest = await readFile(manifestPath, "utf8");
  assert.ok(!/fixture-private|fixture-deployment-token|connectionString|secretText/.test(manifest));
});
