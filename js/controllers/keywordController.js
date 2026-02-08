app.controller('KeywordController', KeywordController);
 
    KeywordController.$inject = ['KeywordsService', 'UserService', 'JSTagsCollection', '$scope'];
    function KeywordController(KeywordsService, UserService, JSTagsCollection, $scope) {
            

        var vm = this;

          // Export jsTags options, inlcuding our own tags object
          

          // **** Typeahead code **** //

          // Build suggestions array

          // var suggestions = [];

            
          

                    $scope.tags = new JSTagsCollection();

                    $scope.jsTagOptions = {
                        'tags': $scope.tags 
                      };


                    //var suggestions = [{"id":1,"keyword":"hello","updated_at":"2015-10-19 16:23:04","created_at":"0000-00-00 00:00:00"},{"id":2,"keyword":"alex","updated_at":"2015-10-19 16:23:04","created_at":"0000-00-00 00:00:00"}];
                     // var suggestions = ['jsTag', 'c#', 'java', 'javascript', 'jquery', 'android' , 'php', 'c++', 'python', 'ios', 'mysql', 'iphone', 'sql', 'html', 'css', 'objective-c', 'ruby-on-rails', 'c', 'sql-server', 'ajax', 'xml', '.net', 'ruby', 'regex', 'database', 'vb.net', 'arrays', 'eclipse', 'json', 'django', 'linux', 'xcode', 'windows', 'html5', 'winforms', 'r', 'wcf', 'visual-studio-2010', 'forms', 'performance', 'excel', 'spring', 'node.js', 'git', 'apache', 'entity-framework', 'asp.net', 'web-services', 'linq', 'perl', 'oracle', 'action-script', 'wordpress', 'delphi', 'jquery-ui', 'tsql', 'mongodb', 'neo4j', 'angularJS', 'unit-testing', 'postgresql', 'scala', 'xaml', 'http', 'validation', 'rest', 'bash', 'django', 'silverlight', 'cake-php', 'elgg', 'oracle', 'cocoa', 'swing', 'mocha', 'amazon-web-services'];
                     // suggestions = suggestions.map(function(item) { //console.log(item);  return { "suggestion": item } });
                   
                    //   //console.log("HELO");
                    // //console.log(suggestions);


                      // Instantiate the bloodhound suggestion engine
                       var suggestions = new Bloodhound({
                        datumTokenizer: function(obj) { return Bloodhound.tokenizers.whitespace(obj.keyword); },
                        identify: function(obj) { return obj.keyword; },
                        queryTokenizer: Bloodhound.tokenizers.whitespace,
                        prefetch: '/api/v1/keywords'
                      });

                      // Initialize the bloodhound suggestion engine
                      suggestions.initialize();

                      


                      // Single dataset example
                      $scope.exampleData = {
                        displayKey: 'keyword',
                        source: suggestions.ttAdapter()
                      };

                      // Typeahead options object
                      $scope.exampleOptions = {
                        hint: false,
                        highlight: true
                      };
           
                      $scope.CheckContent = function(){
                        //console.log("CLICK");
                        //console.log($scope.tags.tags);
                      }
                   
         
       

    }