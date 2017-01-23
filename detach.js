
var async = require('async');
var pkgcloud = require('pkgcloud');

/* message should be of the form:

{
 // cloudant credentials 
 "cloudantURL": "https://username:password@hostname.cloudant.com",
 "dbname": "mydatabase",
 "id": "mydocumentid",

 // object storage credentials
 "auth_url": "https://identity.open.softlayer.com",
 "domainId": "524d4ff43a1b38c6c6718886dfbb279e",
 "domainName": "72244",
 "password": "tfj2ufwbwuGqgw=G",
 "project": "object_storage_123_4567",
 "projectId": "1234567",
 "region": "dallas",
 "role": "admin",
 "userId": "f850a5eb5484ed57b50648693fde445e",
 "username": "admin_325557bde2abb165357707cee6962f6244a062d2"
}

*/

function main(message) {

  // check for required parameters
  var requiredParams = ['id', 'dbname', 'cloudantURL', 'objectStorageCredentials'];
  var errs = [];
  requiredParams.forEach(function(p) {
    if (!message[p]) {
      errs.push(p + 'is a required parameter of this OpenWhisk action');
    }
  });
  if (errs.length > 0) {
    return { err: errs };
  }

  // setup Cloudant library
  var cloudant = require('cloudant')(message.cloudantURL);
  var db = cloudant.use(message.dbname);

  // return a Promise
  return new Promise(function(resolve, reject) {

    // fetch the document
    db.get(message.id, function(err, doc) {
      if (err) {
        return reject(err.msg);
      }

      // if there are attachments
      if (typeof doc._attachments === 'object' && Object.keys(doc._attachments).length > 0) {
        
        var attachments = [];

        // queue handler
        var q = async.queue(function(attName, done) {
          // create a HTTP request to fetch the attachment, but pause it
          var rs =  db.attachment.get(message.id, attName); 
          rs.pause();

          // create a HTTP request to fetch the attachment, but pause it
          var rs =  db.attachment.get(message.id, attName); 
          rs.pause();

          // then write this readstream to Object Storage
          saveFile(message.objectStorageCredentials, rs, 'uploads', doc._id + '-' + attName)
            .then(function(data) {
              attachments.push(data);
              done(null, data)
            })
            .catch(function(err) {
              done(err, null)
            });
        }, 3);


        q.drain = function() {
          delete doc._attachments;
          doc.attachments = attachments;
          db.insert(doc, function(err, data) {
            if (err) {
              return reject(err);
            }
            resolve({ doc: doc, data: data });
          })
        }

        // add all attachment names to the queue
        q.push(Object.keys(doc._attachments));

      } else {
        resolve({msg: 'no attachments found in docId' + message.id});
      }
    });

  });

}



var saveFile = function(creds, rs, directory, filename) {

  var config = {
      provider: 'openstack',
      useServiceCatalog: true,
      useInternal: false,
      keystoneAuthVersion: 'v3',
      authUrl: creds.auth_url,
      tenantId: creds.projectId,    
      domainId: creds.domainId,
      username: creds.username,
      password: creds.password,
      region: creds.region   
  };

  var storageClient = pkgcloud.storage.createClient(config);

  return new Promise(function(resolve, reject) {

    // authenticate the object storage client library
    storageClient.auth(function(err) {
      if (err) {
        return reject(err);
      }

      // create the container
      storageClient.createContainer({name: directory}, function(err, container) {

        var upload = storageClient.upload({
          container: container.name,
          remote: filename
        });

        upload.on('error', function(err) {
          reject(err);
        });

        upload.on('success', function(file) {
          resolve(file.toJSON())
        });

        // pipe the readstream to objet storage
        rs.pipe(upload);
        rs.resume();
      });
    });
  });
}

