#!/bin/bash

echo "🔍 Verifying meta-ads-agent-skill project..."
echo ""

echo "✅ Checking package.json..."
if [ -f "package.json" ]; then
  echo "   ✓ package.json exists"
else
  echo "   ✗ package.json missing"
  exit 1
fi

echo ""
echo "✅ Checking source files..."
required_files=(
  "src/index.ts"
  "src/metaClient.ts"
  "src/config.ts"
  "src/types.ts"
  "src/tools/getAdAccounts.ts"
  "src/tools/getCampaigns.ts"
  "src/tools/getCampaignInsights.ts"
  "src/tools/getAdsetInsights.ts"
  "src/tools/getAdsInsights.ts"
  "src/tools/generateDailyReport.ts"
  "src/analysis/analyzeCampaignPerformance.ts"
  "src/analysis/recommendActions.ts"
  "src/utils/parseActions.ts"
  "src/utils/formatCurrency.ts"
  "src/utils/metaError.ts"
)

for file in "${required_files[@]}"; do
  if [ -f "$file" ]; then
    echo "   ✓ $file"
  else
    echo "   ✗ $file missing"
    exit 1
  fi
done

echo ""
echo "✅ Checking examples..."
if [ -f "examples/daily-report.ts" ] && [ -f "examples/campaign-audit.ts" ]; then
  echo "   ✓ Examples exist"
else
  echo "   ✗ Examples missing"
  exit 1
fi

echo ""
echo "✅ Checking tests..."
if [ -f "tests/analyzeCampaignPerformance.test.ts" ]; then
  echo "   ✓ Tests exist"
else
  echo "   ✗ Tests missing"
  exit 1
fi

echo ""
echo "✅ Checking config files..."
config_files=(".env.example" "tsconfig.json" "tsup.config.ts" "vitest.config.ts" "README.md" "LICENSE")
for file in "${config_files[@]}"; do
  if [ -f "$file" ]; then
    echo "   ✓ $file"
  else
    echo "   ✗ $file missing"
    exit 1
  fi
done

echo ""
echo "✅ Checking build output..."
if [ -d "dist" ] && [ -f "dist/index.js" ] && [ -f "dist/index.d.ts" ]; then
  echo "   ✓ Build artifacts exist"
else
  echo "   ✗ Build artifacts missing"
  exit 1
fi

echo ""
echo "🎉 All checks passed! Project is ready."
