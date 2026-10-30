[CmdletBinding()]
param(
    [switch]$Apply,
    [switch]$UseExistingResourceGroup,
    [string]$SubscriptionId = $env:AZURE_SUBSCRIPTION_ID,
    [string]$TenantId = $env:ENTRA_TENANT_ID,
    [string]$ClientId = $env:AZURE_CLIENT_ID,
    [string]$ResourceGroup = 'rg-dex-escape-prod',
    [string]$Location = 'eastasia',
    [string]$StaticSiteName = '',
    [string]$StorageName = '',
    [string]$AzureCliPath = 'az',
    [string]$GhPath = 'gh',
    [string]$ManifestPath = '',
    [string]$StatePath = '',
    [scriptblock]$ToolRunner = { param($Tool, $Arguments, $InputText) Invoke-DexTool -Tool $Tool -Arguments $Arguments -InputText $InputText }
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'DeploymentPlan.psm1') -Force -DisableNameChecking
if (-not $ManifestPath) { $ManifestPath = Join-Path $PSScriptRoot 'azure.resources.json' }
if (-not $StatePath) { $StatePath = Join-Path $PSScriptRoot '.provision-state.local.json' }

# Read only the existing public SPA identifiers, never evaluate or print an environment file.
$localEnvironment = Join-Path (Split-Path $PSScriptRoot -Parent) '.env.local'
if (Test-Path -LiteralPath $localEnvironment) {
    foreach ($line in [IO.File]::ReadAllLines($localEnvironment)) {
        if ($line -match '^\s*(VITE_ENTRA_TENANT_ID|VITE_ENTRA_CLIENT_ID)\s*=\s*["'']?([a-fA-F0-9-]{36})["'']?\s*$') {
            if ($Matches[1] -eq 'VITE_ENTRA_TENANT_ID' -and -not $TenantId) { $TenantId = $Matches[2] }
            if ($Matches[1] -eq 'VITE_ENTRA_CLIENT_ID' -and -not $ClientId) { $ClientId = $Matches[2] }
        }
    }
}
$saved = $null
foreach ($path in @($ManifestPath, $StatePath)) {
    if (Test-Path -LiteralPath $path) { $saved = ConvertFrom-Json ([IO.File]::ReadAllText($path)); Assert-DexManifest $saved -AllowIncomplete; break }
}
$plan = Get-DeploymentPlan -SubscriptionId $SubscriptionId -TenantId $TenantId -ClientId $ClientId -ResourceGroup $ResourceGroup -Location $Location -StaticSiteName $StaticSiteName -StorageName $StorageName -SavedManifest $saved
$target = $plan.Target
if (-not $Apply) {
    [pscustomobject]@{ mode = 'PlanOnly'; identityConfigured = $plan.IdentityConfigured; repository = $target.repository; branch = $target.branch;
        resourceGroup = $target.resourceGroup; location = $target.location; staticSiteName = $target.staticSiteName;
        storageAccountName = $target.storageAccountName; tableName = $target.tableName; sku = $target.sku;
        useExistingResourceGroup = [bool]$UseExistingResourceGroup;
        savedTarget = ($null -ne $saved); cloudWrites = $false } | ConvertTo-Json
    return
}
if (-not $plan.IdentityConfigured) { throw 'Apply requires explicit subscription, tenant and app client identifiers.' }
if (-not $PSBoundParameters.ContainsKey('ToolRunner')) {
    if ($AzureCliPath -eq 'az' -and -not (Get-Command az -ErrorAction SilentlyContinue)) {
        $knownAz = 'C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd'
        if (Test-Path -LiteralPath $knownAz) { $AzureCliPath = $knownAz }
    }
    foreach ($tool in @($AzureCliPath, $GhPath)) { if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { throw 'Azure CLI and authenticated GitHub CLI are required before Apply.' } }
}
function Call-Az {
    param([string[]]$Arguments)
    return & $ToolRunner -Tool $AzureCliPath -Arguments (@($Arguments) + @('--subscription', $plan.SubscriptionId, '--output', 'json', '--only-show-errors')) -InputText $null
}
function Call-Gh {
    param([string[]]$Arguments, [AllowNull()][string]$InputText = $null)
    return & $ToolRunner -Tool $GhPath -Arguments $Arguments -InputText $InputText
}

# All identity/repository/region checks happen before any paid resource creation.
$account = Call-Az @('account','show')
if ($account.id -ine $plan.SubscriptionId -or $account.tenantId -ine $plan.TenantId -or $account.state -ine 'Enabled') { throw 'Azure subscription or tenant does not match the intended company context.' }
$permissionScope = '/subscriptions/' + $plan.SubscriptionId
if ($saved -or $UseExistingResourceGroup) { $permissionScope += '/resourceGroups/' + $target.resourceGroup }
$permissions = Call-Az @('rest','--method','get','--url',('https://management.azure.com' + $permissionScope + '/providers/Microsoft.Authorization/permissions?api-version=2022-04-01'))
Assert-DexDeploymentPermissions -Permissions $permissions -NeedResourceGroupCreation:($null -eq $saved -and -not $UseExistingResourceGroup)
$repository = Call-Gh @('api','repos/Hyeongdae/edu')
if ($repository.full_name -cne 'Hyeongdae/edu' -or -not $repository.permissions.push) { throw 'Authenticated GitHub account cannot push to the intended repository.' }
$null = Call-Gh @('api','repos/Hyeongdae/edu/actions/secrets/public-key')
$application = Call-Az @('ad','app','show','--id',$plan.ClientId)
if ($application.appId -ine $plan.ClientId -or $application.signInAudience -cne 'AzureADMyOrg') { throw 'The configured app must remain single-tenant.' }
$enterpriseApp = Call-Az @('ad','sp','show','--id',$plan.ClientId)
if ($enterpriseApp.appRoleAssignmentRequired) { throw 'The existing enterprise app restricts user assignment; review it before enabling the selected tenant-wide audience.' }
$operator = Call-Az @('ad','signed-in-user','show')
$owners = @(Call-Az @('ad','app','owner','list','--id',$plan.ClientId))
if (-not @($owners | Where-Object { $_.id -ieq $operator.id }).Count) { throw 'Use an authenticated owner of the existing app registration for this deployment.' }
if (-not $UseExistingResourceGroup) {
foreach ($entry in @(@('Microsoft.Web','staticSites'), @('Microsoft.Storage','storageAccounts'))) {
    $provider = Call-Az @('provider','show','--namespace',$entry[0])
    $resourceType = @($provider.resourceTypes | Where-Object { $_.resourceType -ceq $entry[1] })
    if ($provider.registrationState -ine 'Registered' -or -not $resourceType.Count -or
        -not @($resourceType[0].locations | Where-Object { $_.Replace(' ','').ToLowerInvariant() -ceq $target.location }).Count) { throw 'Requested region/provider is not available; select a supported region before Apply.' }
}
}
if ($UseExistingResourceGroup -and -not $saved) {
    $group = Call-Az @('group','show','--name',$target.resourceGroup)
    Assert-DexOwnedResource -Resource $group -ExpectedName $target.resourceGroup -Tags $plan.Tags
    $groupContents = @(Call-Az @('resource','list','--resource-group',$target.resourceGroup))
    if ($groupContents.Count) { throw 'The pre-created deployment resource group must be dedicated and empty.' }
    $exists = $true
} else {
    $exists = Call-Az @('group','exists','--name',$target.resourceGroup)
}
if ($exists -and -not ($UseExistingResourceGroup -and -not $saved)) {
    $group = Call-Az @('group','show','--name',$target.resourceGroup)
    if ($null -eq $saved) { throw 'Existing resources require an owned saved manifest or recovery journal.' }
    Assert-DexOwnedResource -Resource $group -ExpectedName $target.resourceGroup -Tags $plan.Tags
}
$existingStorage = @()
if ($exists) {
    $existingStorage = @(Call-Az @('storage','account','list','--resource-group',$target.resourceGroup) | Where-Object { $_.name -ceq $target.storageAccountName })
    if ($existingStorage.Count) { Assert-DexOwnedResource -Resource $existingStorage[0] -ExpectedName $target.storageAccountName -Tags $plan.Tags }
}
$storageNameStatus = Call-Az @('storage','account','check-name','--name',$target.storageAccountName)
if (-not $storageNameStatus.nameAvailable -and -not $existingStorage.Count) { throw 'Storage name is unavailable and is not part of this owned deployment.' }
$tagArguments = @('project=dex-escape','repository=Hyeongdae/edu','environment=production')
if ($saved) { $target = ConvertTo-DexMap $saved }
Write-DexManifest -Manifest $target -Path $StatePath -AllowIncomplete
if (-not $exists) { $null = Call-Az (@('group','create','--name',$target.resourceGroup,'--location',$target.location,'--tags') + $tagArguments) }
$sites = @(Call-Az @('staticwebapp','list','--resource-group',$target.resourceGroup))
$site = @($sites | Where-Object { $_.name -ceq $target.staticSiteName })
if ($site.Count) {
    $site = $site[0]; Assert-DexOwnedResource -Resource $site -ExpectedName $target.staticSiteName -Tags $plan.Tags
    if ($site.sku.name -cne 'Standard') { throw 'The owned site must use Standard.' }
} else {
    $site = Call-Az (@('staticwebapp','create','--name',$target.staticSiteName,'--resource-group',$target.resourceGroup,'--location',$target.location,'--sku','Standard','--tags') + $tagArguments)
}
$target.defaultHostName = $site.defaultHostname; $target.url = 'https://' + $site.defaultHostname
Assert-DexManifest $target -AllowIncomplete
Write-DexManifest -Manifest $target -Path $StatePath -AllowIncomplete
$storageAccounts = @(Call-Az @('storage','account','list','--resource-group',$target.resourceGroup))
$storage = @($storageAccounts | Where-Object { $_.name -ceq $target.storageAccountName })
if ($storage.Count) {
    $storage = $storage[0]; Assert-DexOwnedResource -Resource $storage -ExpectedName $target.storageAccountName -Tags $plan.Tags
    if ($storage.allowBlobPublicAccess -ne $false -or $storage.enableHttpsTrafficOnly -ne $true -or $storage.minimumTlsVersion -cne 'TLS1_2' -or
        $storage.kind -cne 'StorageV2' -or $storage.sku.name -cne 'Standard_LRS') { throw 'Existing storage does not match the required private HTTPS configuration.' }
} else {
    $storage = Call-Az (@('storage','account','create','--name',$target.storageAccountName,'--resource-group',$target.resourceGroup,
        '--location',$target.location,'--kind','StorageV2','--sku','Standard_LRS','--https-only','true','--min-tls-version','TLS1_2','--allow-blob-public-access','false','--tags') + $tagArguments)
}

$privateDirectory = New-DexPrivateDirectory
$privateFiles = [Collections.Generic.List[string]]::new()
function Private-Json {
    param($Body)
    $file = Join-Path $privateDirectory ([guid]::NewGuid().ToString('N') + '.json')
    $privateFiles.Add($file)
    [IO.File]::WriteAllText($file, ($Body | ConvertTo-Json -Depth 20), [Text.UTF8Encoding]::new($false))
    return '@' + $file
}
try {
    $siteId = '/subscriptions/' + $plan.SubscriptionId + '/resourceGroups/' + $target.resourceGroup + '/providers/Microsoft.Web/staticSites/' + $target.staticSiteName
    $storageId = '/subscriptions/' + $plan.SubscriptionId + '/resourceGroups/' + $target.resourceGroup + '/providers/Microsoft.Storage/storageAccounts/' + $target.storageAccountName
    $tableRoot = 'https://management.azure.com' + $storageId + '/tableServices/default/tables'
    $tables = Call-Az @('rest','--method','get','--url',($tableRoot + '?api-version=2023-05-01'))
    if (-not @($tables.value | Where-Object { $_.name -ceq $target.tableName }).Count) {
        $body = Private-Json @{ properties = @{} }
        $null = Call-Az @('rest','--method','put','--url',($tableRoot + '/' + $target.tableName + '?api-version=2023-05-01'),'--body',$body)
    }
    $web = ConvertTo-DexMap $application.web
    $existingUris = @(if ($web.ContainsKey('redirectUris')) { $web.redirectUris })
    $callback = $target.url + '/.auth/login/aad/callback'
    $redirects = @(Merge-EntraWebRedirects -Existing $existingUris -Callback $callback)
    if ($redirects.Count -ne $existingUris.Count -or $callback -cnotin $existingUris) {
        $web['redirectUris'] = $redirects
        $body = Private-Json @{ web = $web }
        $null = Call-Az @('rest','--method','patch','--url',('https://graph.microsoft.com/v1.0/applications/' + $application.id),'--body',$body)
    }
    $settingsResponse = Call-Az @('rest','--method','post','--url',('https://management.azure.com' + $siteId + '/listAppSettings?api-version=2025-05-01'))
    $settings = ConvertTo-DexMap $settingsResponse.properties
    $metadata = ConvertTo-DexMap $target.credential
    $keepCredential = $metadata.keyId -and $settings.ContainsKey('GAME_ENTRA_CLIENT_SECRET') -and $settings.GAME_ENTRA_CLIENT_SECRET -and
        ([DateTimeOffset]::Parse($metadata.expiresAt) -gt [DateTimeOffset]::UtcNow.AddDays(7)) -and
        @($application.passwordCredentials | Where-Object { $_.keyId -ieq $metadata.keyId }).Count
    if (-not $keepCredential) {
        $expiry = [DateTime]::UtcNow.AddDays(180).ToString('o')
        $body = Private-Json @{ passwordCredential = @{ displayName = ('dex-escape-production-' + $target.staticSiteName); endDateTime = $expiry } }
        $password = Call-Az @('rest','--method','post','--url',('https://graph.microsoft.com/v1.0/applications/' + $application.id + '/addPassword'),'--body',$body)
        if (-not $password.secretText) { throw 'App credential was not returned; no settings were replaced.' }
        $settings['GAME_ENTRA_CLIENT_SECRET'] = $password.secretText
        $target.credential = @{ keyId = $password.keyId; expiresAt = $password.endDateTime }
        Write-DexManifest -Manifest $target -Path $StatePath -AllowIncomplete
    }
    $connection = Call-Az @('storage','account','show-connection-string','--name',$target.storageAccountName,'--resource-group',$target.resourceGroup)
    $settings['AZURE_CLIENT_ID'] = $plan.ClientId
    $settings['GAME_RECORDS_CONNECTION_STRING'] = $connection.connectionString
    $settings['GAME_RECORDS_TABLE'] = $target.tableName
    $body = Private-Json @{ properties = $settings }
    $null = Call-Az @('rest','--method','put','--url',('https://management.azure.com' + $siteId + '/config/appsettings?api-version=2025-05-01'),'--body',$body)
    $token = Call-Az @('staticwebapp','secrets','list','--name',$target.staticSiteName,'--resource-group',$target.resourceGroup)
    if (-not $token.properties.apiKey) { throw 'No game deployment token was returned.' }
    $null = Call-Gh -Arguments @('secret','set','AZURE_STATIC_WEB_APPS_API_TOKEN','--repo','Hyeongdae/edu') -InputText $token.properties.apiKey
    $null = Call-Gh @('variable','set','ENTRA_TENANT_ID','--repo','Hyeongdae/edu','--body',$plan.TenantId)
    $null = Call-Gh @('variable','set','AZURE_DEPLOY_ENABLED','--repo','Hyeongdae/edu','--body','true')
    Write-DexManifest -Manifest $target -Path $ManifestPath
    [pscustomobject]@{ mode = 'Applied'; url = $target.url; resourceGroup = $target.resourceGroup; sku = $target.sku;
        tableName = $target.tableName; expiresAt = $target.credential.expiresAt; deploymentPending = $true } | ConvertTo-Json
} finally {
    foreach ($file in $privateFiles) {
        $actual = [IO.Path]::GetFullPath($file)
        if ([IO.Path]::GetDirectoryName($actual) -cne $privateDirectory -or [IO.Path]::GetFileName($actual) -notmatch '^[a-f0-9]{32}\.json$') { throw 'Refusing unsafe private-file cleanup.' }
        if (Test-Path -LiteralPath $actual) { Remove-Item -LiteralPath $actual -Force }
    }
    # Non-recursive: never traverse a link or remove unknown files on cleanup.
    if (Test-Path -LiteralPath $privateDirectory) { [IO.Directory]::Delete($privateDirectory) }
}
