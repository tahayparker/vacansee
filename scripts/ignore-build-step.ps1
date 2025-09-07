# Vercel Ignored Build Step (PowerShell version)
#
# This script tells Vercel whether to skip a build based on the commit message.
# If the commit message contains "[skip ci]" or "skip deploy", the build will be skipped.
#
# Exit codes:
# - 0: Skip the build
# - 1: Continue with the build

try {
    # Get the latest commit message
    $commitMessage = git log -1 --pretty=%B
    $commitMessage = $commitMessage.Trim()

    Write-Host "Latest commit message: $commitMessage"

    # Check if the commit message contains skip patterns
    $skipPatterns = @('[skip ci]', 'skip deploy')
    $shouldSkip = $false

    foreach ($pattern in $skipPatterns) {
        if ($commitMessage.ToLower().Contains($pattern.ToLower())) {
            $shouldSkip = $true
            break
        }
    }

    if ($shouldSkip) {
        Write-Host "🚫 Build skipped - commit message contains skip instruction"
        exit 0  # Skip build
    } else {
        Write-Host "✅ Proceeding with build"
        exit 1  # Continue with build
    }
} catch {
    Write-Host "Error checking commit message: $($_.Exception.Message)"
    Write-Host "⚠️ Proceeding with build due to error"
    exit 1  # Continue with build on error
}
