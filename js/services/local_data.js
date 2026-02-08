//ATHENTICATION SERVICES

app.factory('LocalDataService', LocalDataService);

    LocalDataService.$inject = [];
    function LocalDataService() {
        // this is my local data service to keep things happy
        // use this to keep all data accessible from anywhere without calling the server every 10 seconds
       return {
            data: {
              selected_images: [],
              all_galleries: [],
              selecting_for: 0
            },
            SetSelectedImages: function(selected_images) {
                this.data.selected_images = selected_images;
            },
            SetAllGalleries: function(data){
                this.data.all_galleries = data;
            },
            SetSelectingFor: function(data){
                this.data.selecting_for = data;
            }
        };

    }