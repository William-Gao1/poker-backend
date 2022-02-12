const {QueryFile} = require('pg-promise');
const {join: joinPath} = require('path');

const createSQLFile = (file) => {
    const fullPath = joinPath(__dirname, '../sql/', file + '.sql'); // generating full path;
    return new QueryFile(fullPath, {minify: true});
}

module.exports = createSQLFile