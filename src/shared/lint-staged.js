const config = {
	'{src,tests}/**/*.js': ['./Taskfile.sh lint', './Taskfile.sh format'],
	'{*,{src,tests}/**/*}.+(js|jsx|css)': ['./Taskfile.sh format'],
	'*.md': ['./Taskfile.sh format'],
};

module.exports = config;
