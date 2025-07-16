# Claude Max User Guide

## 🎉 Your Repository is Claude Max Ready!

This repository is fully configured to work with your **Claude Max subscription** via the Claude GitHub App. No API keys needed!

## How to Use Claude in Your Repository

### 1. Basic Interaction
Simply tag `@claude` in any issue or pull request comment:

```
@claude Can you help me understand this validation logic?
```

```
@claude I'm getting an error when testing the address lookup feature
```

### 2. Code Reviews
Tag Claude in pull request comments for automated code review:

```
@claude Please review this PR and suggest improvements
```

```
@claude Check if this implementation follows best practices
```

### 3. Bug Fixes
Claude can help identify and fix bugs:

```
@claude There's a bug in the map rendering, can you help fix it?
```

```
@claude The USPS validation is failing, what could be wrong?
```

### 4. Feature Development
Ask Claude to help implement new features:

```
@claude Add error handling to the district lookup function
```

```
@claude Can you add unit tests for the address validation service?
```

### 5. Getting Help
Use the help command to see available options:

```
@claude help
```

## What Happens When You Use Claude

1. **Claude Responds**: The GitHub App will automatically respond to your comment
2. **Automatic Testing**: If Claude makes code changes, tests will run automatically
3. **Test Results**: You'll get notifications if tests pass or fail
4. **Continuous Integration**: All changes are validated through the CI pipeline

## Available Features

✅ **Code Analysis**: Claude can analyze and explain complex code  
✅ **Bug Detection**: Identify issues in your code  
✅ **Test Generation**: Create unit and integration tests  
✅ **Code Review**: Get detailed feedback on pull requests  
✅ **Documentation**: Update README files and code comments  
✅ **Refactoring**: Improve code structure and performance  
✅ **Security Review**: Check for potential security issues  

## CI/CD Integration

Your repository includes:

- **Automated Testing**: Playwright tests run on every push
- **Code Quality**: Linting and security checks
- **Performance Monitoring**: Lighthouse CI for web performance
- **Multi-browser Testing**: Chrome, Firefox, Safari, Mobile
- **Deployment Pipeline**: Automated deployment to production

## Example Interactions

### Code Explanation
```
@claude Can you explain how the district boundary detection works in the map.js file?
```

### Bug Fix Request
```
@claude The address validation modal is not showing error messages properly. Can you investigate and fix this issue?
```

### Feature Request
```
@claude Add a loading spinner to the address search to improve user experience
```

### Test Addition
```
@claude Add comprehensive tests for the USPS OAuth service
```

### Performance Optimization
```
@claude The map is loading slowly with large datasets. Can you optimize the rendering performance?
```

## Best Practices

1. **Be Specific**: Provide clear, detailed requests
2. **Include Context**: Mention file names and specific functionality
3. **Test Changes**: Always review Claude's suggestions before merging
4. **Use Issues**: Create issues for complex problems that need discussion
5. **Review PRs**: Use Claude for code review on pull requests

## Repository Structure

- `public/js/` - Frontend JavaScript modules
- `services/` - Backend service classes
- `tests/` - Playwright test suite
- `docs/` - Documentation
- `.github/workflows/` - CI/CD pipelines

## Getting Started

1. **Create an Issue**: Try creating an issue and tagging `@claude help`
2. **Test a Simple Request**: Ask Claude to explain a function
3. **Review the CI Pipeline**: Check the Actions tab to see automated tests
4. **Explore Features**: Try different types of requests

## Support

- **GitHub Issues**: Use for complex problems and feature requests
- **Pull Requests**: Tag Claude for code reviews
- **Documentation**: Check the `.github/README.md` for detailed CI/CD info

---

**Ready to start?** Create an issue and tag `@claude help` to begin! 🚀