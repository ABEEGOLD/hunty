import json
import subprocess

# Map issue titles to labels
ISSUE_LABELS = {
    "[UI/UX] Implement Dark Mode Support": "enhancement,ui/ux",
    "[UI/UX] Add Skeleton Loaders for Hunt List": "enhancement,ui/ux",
    "[Feature] Integrate Freighter Wallet": "feature,blockchain",
    "[Feature] Hunt Discovery Search & Filter": "feature,ui/ux",
    "[Profile] User Dashboard Page": "feature,ui/ux",
    "[Game] Real-time Hunt Completion Notifications": "feature,blockchain",
    "[NFT] NFT Gallery Component": "feature,ui/ux",
    "[Onboarding] Interactive Tutorial for New Players": "enhancement,onboarding",
    "[Forms] Advanced Validation for Hunt Creation": "bug,quality",
    "[UX] Success Confetti on Completion": "enhancement,ui/ux",
    "[Tech] Implement Gasless Transactions": "feature,blockchain",
    "[Refactor] Centralize Blockchain Error Handling": "refactor,quality",
    "[Tech] Add Unit Tests for Hunt Store": "testing,quality",
    "[Tech] E2E Test for Core Game Loop": "testing,quality",
    "[Docs] API Reference for Soroban Interactivity": "documentation",
    "[SEO] Optimize Metadata for Social Sharing": "enhancement,seo",
    "[UX] Download Certificate/NFT as Image": "enhancement,ui/ux",
    "[UI] Responsive Design Audit & Fixes": "bug,ui/ux",
    "[Performance] Image Optimization for IPFS Assets": "performance,quality",
    "[DevOps] Setup GitHub Actions for CI/CD": "devops,quality"
}

def run_command(command):
    result = subprocess.run(command, capture_output=True, text=True, shell=True)
    return result

def main():
    # Create remaining labels
    for label, info in {
        "seo": ("B60205", "Search Engine Optimization"),
        "performance": ("5319E7", "Performance optimizations"),
        "devops": ("006B75", "CI/CD and deployment tasks")
    }.items():
        run_command(f"gh label create {label} --color {info[0]} --description \"{info[1]}\"")

    # Get the last 30 issues
    result = run_command("gh issue list --limit 30 --json number,title")
    if result.returncode != 0:
        print(f"Error fetching issues: {result.stderr}")
        return

    issues = json.loads(result.stdout)
    for issue in issues:
        number = issue['number']
        title = issue['title']
        
        if title in ISSUE_LABELS:
            labels = ISSUE_LABELS[title]
            print(f"Updating issue #{number}: {title} with labels: {labels}")
            run_command(f"gh issue edit {number} --add-label \"{labels}\"")

if __name__ == "__main__":
    main()
