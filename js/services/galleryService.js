app.factory('GalleryService', GalleryService);

    GalleryService.$inject = ['$http'];
    function GalleryService($http) {

        // console.log("CALLED");
       var service = {};

        service.GetAll = GetAll;
        service.GetById = GetById;
        service.Create = Create;
        service.Update = Update;
        service.Delete = Delete;
        service.CheckLink = CheckLink;
        service.GetByUrl = GetByUrl;
        service.DownloadZip = DownloadZip;
       
        return service; 

        function GetAll() {
            return $http.get('/api/v1/gallery/').then(handleSuccess, handleError('Error getting all Image'));
        }

        function GetById(gallery_id) {
            return $http.get('/api/v1/gallery/' + gallery_id).then(handleSuccess, handleError('Error getting Image by id'));
        }

        function GetByUrl(url){
            return $http.post('/api/v1/gallery/get_by_url', url).then(handleSuccess, handleError('Error getting Image by id'));
        }

        function Create(gallery) {
            var url = '/api/v1/gallery/';
            return $http.post(url, gallery).then(handleSuccess, handleError('Error creating Image'));
        }

        function Update(gallery) {
            return $http.put('/api/v1/gallery/' + gallery.id, gallery).then(handleSuccess, handleError('Error updating Image'));
        }

        function Delete(gallery_id) {
            return $http.delete('/api/v1/gallery/' + gallery_id).then(handleSuccess, handleError('Error deleting Image'));
        }

        function CheckLink(link){
            return $http.post('/api/v1/gallery/check_link', {gallery_link: link}).then(handleSuccess, handleError('Error creating Image'));
        }
        //download_zip
        function DownloadZip(zip){
            return $http.post('/api/v1/gallery/download_zip', zip).then(handleSuccess, handleError('Error creating Image'));
        }


        // private functions

        function handleSuccess(res) {
            return res.data;
        }

        function handleError(error) {
            return function () {
                return { success: false, message: error };
            };
        }
    }