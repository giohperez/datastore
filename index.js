let mongo = require('mongodb'),
	// server = requite('http-server'),
	MongoClient = mongo.MongoClient,
	url = "mongodb://localhost:27017/mydb",
	db = null,
	collections = [
		'emails'
	],
	store = {},
	http = require('http'),
	hostname = '127.0.0.1',
	port = 3001,
	server = null;


function database(cb) {
	return MongoClient.connect(url, function(err, _db) {
	  if (err) throw err;
	  cb && cb(_db)
	  return;
	});
}

function webserver() {
	return http.createServer((req, res) => {
			let path = req.url.split('/'),
					operation = path[1],
					collection = path[2],
					query = path[3],
					writeData = path[4],
					assemble = (qs) =>{
						let assembled = {},
								properties = decodeURI(qs).split(',');
								console.log('trying to assemble following query string - ', qs, properties);
						if(!qs || properties.length < 1) {
							return null;
						}
						for(let i = 0; i < properties.length; i++){
							if(properties[i].length > 0 && properties[i].split('>').length > 1){
								assembled[properties[i].split('>')[0].trim()] = properties[i].split('>')[1];
								continue;
							}
						}
						console.log('assembled', assembled);
						return assembled;
					},
					assembledQuery = assemble(query),
					assembledWriteData = assemble(writeData),
					handle = () => {
						switch(operation) {
							case 'create':
								if(!assembledQuery) {
									db.createCollection(collection, (err, results) => {
										if(err){
											res.statusCode = 401;
											res.end(JSON.stringify({
												status: 'error',
												result: 'Creating collection threw error'
											}));
										}
										res.statusCode = 200;
										res.end(JSON.stringify({
											status: 'success',
											result: 'Collection '+collection+' created'
										}));
									});
									break;
								}
								db.collection(collection).insertOne(JSON.parse(assembledQuery), (err, result) => {
									res.statusCode = 200;
									res.end(JSON.stringify({
										status: 'success',
										result: result
									}));
								});
								break;
							case 'read':
								// let _query = 
								db.collection(collection).find(JSON.parse(assembledQuery)).toArray((err, result) => {
									if(result){
										res.statusCode = 200;
										res.end(JSON.stringify({
											status: 'success',
											result: result
										}));
									}
								});
								break;
							case 'delete':
								if(!query || !assembledQuery){
									res.statusCode = 401;
									res.end(JSON.stringify({
										status:'error',
										result: 'Deletion of an entire collection is currently locked'
									}))
								}
								db.collection(collection).deleteOne(JSON.parse(assembledQuery), (err, result) => {
									if(err) {
										res.statusCode = 401;
										res.end(JSON.stringify({
											status: 'error',
											result: 'Deletion of '+query+' in collection '+collection+' returned an error'
										}))
									}
									res.statusCode = 200;
									res.end(JSON.stringify({
										status: 'success',
										result: 'Deletion of '+query+' in collection '+collection+' success'
									}));
								})
								break;
							case 'update':
								let update = (mergedWriteData) => {
									db.collection(collection).updateOne(JSON.parse(assembledQuery), mergedWriteData, (err, result) => {
										if(err) {
											res.statusCode = 401;
											res.end(JSON.stringify({
												status: 'error',
												result: 'Could not update '+query+' in collection '+collection
											}))
										}
										res.statusCode = 200;
										res.end(JSON.stringify({
											status: 'success',
											result: 'Updated '+query+' in collection '+collection
										}))
									});
								};
								db.collection(collection).findOne(JSON.parse(assembledQuery), (err, result) => {
									if(err) {
										res.statusCode = 401;
										res.end(JSON.stringify({
											status:'error',
											result: 'Could not find record '+query+' to update in collection '+collection
										}));
									}
									update(Object.assign({}, result, JSON.parse(assembledWriteData)));
								});
								break;
							};
					}

			res.setHeader('Content-Type', 'application/json');
			res.setHeader("Access-Control-Allow-Origin", "*");

			console.log(req.body)

			if (req.method == 'POST') {
        req.on('data', (data) => {
        	if(!query) {
        		assembledQuery = assembledQuery || '';
        		assembledQuery += data;
        	} else {
        		assembledWriteData = assembledWriteData || '';
            assembledWriteData += data;
        	}
        });
        req.on('end', () => {
        	assembledQuery && JSON.parse(assembledQuery);
          assembledWriteData && JSON.parse(assembledWriteData);
          handle();
        });
        return;
			}
			handle();
			return;
	});
}



function init() {
	database((_db)=>{
		
		db = _db;

		for(let i = 0; i < collections.length; i++) {
			db.createCollection(collections[i], (err, res) => {
			   if (err) throw err;
			 });
		}

		server = webserver();

		server.listen(port, hostname, () => {
		  console.log(`Server running at http://${hostname}:${port}/`);
		});

	});
}

init();
