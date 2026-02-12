app.factory('CourseService', CourseService);

    CourseService.$inject = ['$http', '$location'];
    function CourseService($http, $location) {
        var service = {};
        
        service.GetCourseById = GetCourseById;
        service.GetCoursesByUserId = GetCoursesByUserId;
        service.GetCoursesByClubId = GetCoursesByClubId;
        service.CreateCourse = CreateCourse;
        service.UpdateCourse = UpdateCourse;
        service.DeleteCourse = DeleteCourse;

        service.GetLessonById = GetLessonById;
        service.GetLessonsByCourseId = GetLessonsByCourseId;
        service.CreateLesson = CreateLesson;
        service.UpdateLesson = UpdateLesson;
        service.DeleteLesson = DeleteLesson;
        service.UpdateLessonOrder = UpdateLessonOrder;

        service.GetTemByLessonId = GetTemByLessonId;
        service.CreateTem = CreateTem;
        service.UpdateTem = UpdateTem;
        service.DeleteTem = DeleteTem;
        service.UpdateTemOrder = UpdateTemOrder;

        service.GetBulletsByLessonId = GetBulletsByLessonId;
        service.CreateBullet = CreateBullet;
        service.UpdateBullet = UpdateBullet;
        service.DeleteBullet = DeleteBullet;
        service.UpdateBulletOrder = UpdateBulletOrder;

        service.GetItemsByLessonId = GetItemsByLessonId;
        service.CreateItem = CreateItem;
        service.UpdateItem = UpdateItem;
        service.DeleteItem = DeleteItem;
        service.UpdateItemsOrder = UpdateItemsOrder;
       
        service.GetExamsByCourseId = GetExamsByCourseId;
        service.CreateExam = CreateExam;
        service.UpdateExam = UpdateExam;
        service.DeleteExam = DeleteExam;

        service.GetChargesByCourseId = GetChargesByCourseId;
        service.CreateCharge = CreateCharge;
        service.UpdateCharge = UpdateCharge;
        service.DeleteCharge = DeleteCharge;

        service.CreateTrainingRecord = CreateTrainingRecord;
        service.GetStudentTrainingRecords = GetStudentTrainingRecords;
        service.CreateExamRecord = CreateExamRecord;
        service.UpdateTrainingRecord = UpdateTrainingRecord;


        service.GetTagsByCourseId = GetTagsByCourseId;
        service.CreateTags = CreateTags;
        service.UpdateTags = UpdateTags;
        service.DeleteTags = DeleteTags;

        service.GetStudentTrainingRecordsForFlight = GetStudentTrainingRecordsForFlight;

        // LESSON CONTENT FILES
        service.GetLessonContentFiles = GetLessonContentFiles;
        service.GetLessonContentFileData = GetLessonContentFileData;
        service.UploadLessonContentFile = UploadLessonContentFile;
        service.DeleteLessonContentFile = DeleteLessonContentFile;
        service.UpdateLessonContentFile = UpdateLessonContentFile;
        service.UpdateLessonContentFilesOrder = UpdateLessonContentFilesOrder;


        return service; 

        //settings for the licences... not sure they'll be required anywhere else - so keep em here now...

        function GetCourseById(id) {
            return $http.get('/api/v1/courses/' + id).then(handleSuccess, handleError2);
        }

        function GetCoursesByClubId(club_id) {
            return $http.get('/api/v1/courses/club/'+club_id).then(handleSuccess, handleError2);
        }

        function GetCoursesByUserId(user_id){
            return $http.get('/api/v1/courses/user/'+user_id).then(handleSuccess, handleError2);
        }

        function CreateCourse(nok) {
            return $http.post('/api/v1/courses', nok).then(handleSuccess, handleError2);
        }

        function UpdateCourse(nok) {
            return $http.put('/api/v1/courses/' + nok.id, nok).then(handleSuccess, handleError2);
        }

        function DeleteCourse(id) {
            return $http.delete('/api/v1/courses/' + id).then(handleSuccess, handleError2);
        }


        //LESSONS


        function GetLessonById(id) {
            return $http.get('/api/v1/lessons/' + id).then(handleSuccess, handleError2);
        }

        function GetLessonsByCourseId(course_id) {
            return $http.get('/api/v1/lessons/course/'+course_id).then(handleSuccess, handleError2);
        }

        function CreateLesson(nok) {
            return $http.post('/api/v1/lessons', nok).then(handleSuccess, handleError2);
        }

        function UpdateLesson(nok) {
            return $http.put('/api/v1/lessons/' + nok.id, nok).then(handleSuccess, handleError2);
        }

        function DeleteLesson(id) {
            return $http.delete('/api/v1/lessons/' + id).then(handleSuccess, handleError2);
        }

        function UpdateLessonOrder(bullets){
            return $http.post('/api/v1/lessons/organise', bullets).then(handleSuccess, handleError2);

        }


        //TEM
        function GetTemByLessonId(lesson_id) {
            return $http.get('/api/v1/lesson_tem/lesson/'+lesson_id).then(handleSuccess, handleError2);
        }

        function CreateTem(obj) {
            return $http.post('/api/v1/lesson_tem', obj).then(handleSuccess, handleError2);
        }

        function UpdateTem(obj) {
            return $http.put('/api/v1/lesson_tem/' + obj.id, obj).then(handleSuccess, handleError2);
        }

        function DeleteTem(id) {
            return $http.delete('/api/v1/lesson_tem/' + id).then(handleSuccess, handleError2);
        }

        function UpdateTemOrder(bullets){
            return $http.post('/api/v1/lesson_tem/organise', bullets).then(handleSuccess, handleError2);

        }


        //BULLETS
        function GetBulletsByLessonId(lesson_id) {
            return $http.get('/api/v1/lesson_bullets/lesson/'+lesson_id).then(handleSuccess, handleError2);
        }

        function CreateBullet(obj) {
            return $http.post('/api/v1/lesson_bullets', obj).then(handleSuccess, handleError2);
        }

        function UpdateBullet(obj) {
            return $http.put('/api/v1/lesson_bullets/' + obj.id, obj).then(handleSuccess, handleError2);
        }

        function DeleteBullet(id) {
            return $http.delete('/api/v1/lesson_bullets/' + id).then(handleSuccess, handleError2);
        }

        function UpdateBulletOrder(bullets){
            return $http.post('/api/v1/lesson_bullets/organise', bullets).then(handleSuccess, handleError2);

        }


        //MARKING ITEMS --> ITEMS
        function GetItemsByLessonId(lesson_id) {
            return $http.get('/api/v1/lesson_items/lesson/'+lesson_id).then(handleSuccess, handleError2);
        }

        function CreateItem(obj) {
            return $http.post('/api/v1/lesson_items', obj).then(handleSuccess, handleError2);
        }

        function UpdateItem(obj) {
            return $http.put('/api/v1/lesson_items/' + obj.id, obj).then(handleSuccess, handleError2);
        }

        function DeleteItem(id) {
            return $http.delete('/api/v1/lesson_items/' + id).then(handleSuccess, handleError2);
        }
        function UpdateItemsOrder(items){
            return $http.post('/api/v1/lesson_items/organise', items).then(handleSuccess, handleError2);

        }


        //EXAMS 
        function GetExamsByCourseId(lesson_id) {
            return $http.get('/api/v1/exams/course/'+lesson_id).then(handleSuccess, handleError2);
        }

        function CreateExam(obj) {
            return $http.post('/api/v1/exams', obj).then(handleSuccess, handleError2);
        }

        function UpdateExam(obj) {
            return $http.put('/api/v1/exams/' + obj.id, obj).then(handleSuccess, handleError2);
        }

        function DeleteExam(id) {
            return $http.delete('/api/v1/exams/' + id).then(handleSuccess, handleError2);
        }
        // function UpdateItemsOrder(items){
        //     return $http.post('/api/v1/exams/organise', items).then(handleSuccess, handleError2);

        // }


        //FLIGHT TAGS

        function GetTagsByCourseId(lesson_id) {
            return $http.get('/api/v1/tags/course/'+lesson_id).then(handleSuccess, handleError2);
        }

        function CreateTags(obj) {
            return $http.post('/api/v1/tags', obj).then(handleSuccess, handleError2);
        }

        function UpdateTags(obj) {
            return $http.put('/api/v1/tags/' + obj.id, obj).then(handleSuccess, handleError2);
        }

        function DeleteTags(id) {
            return $http.delete('/api/v1/tags/' + id).then(handleSuccess, handleError2);
        }



        //INSTRUCTOR CHARGES 
        function GetChargesByCourseId(course_id) {
            return $http.get('/api/v1/instructor_charges/course/'+course_id).then(handleSuccess, handleError2);
        }

        function CreateCharge(obj) {
            return $http.post('/api/v1/instructor_charges', obj).then(handleSuccess, handleError2);
        }

        function UpdateCharge(obj) {
            return $http.put('/api/v1/instructor_charges/' + obj.id, obj).then(handleSuccess, handleError2);
        }

        function DeleteCharge(id) {
            return $http.delete('/api/v1/instructor_charges/' + id).then(handleSuccess, handleError2);
        }



        //DEBRIEF
        function GetCourseForDebrief(booking_id){
            return $http.get('/api/v1/courses/debrief/'+booking_id).then(handleSuccess, handleError2);
        }

        function CreateTrainingRecord(obj){
            return $http.post('/api/v1/training_records', obj).then(handleSuccess, handleError2);
        }

        function UpdateTrainingRecord(obj, id){
            return $http.put('/api/v1/training_records/'+id, obj).then(handleSuccess, handleError2);
        }

        function GetStudentTrainingRecords(user_id, course_id){
            return $http.get('/api/v1/training_records/student/'+course_id+'/'+user_id).then(handleSuccess, handleError2);
        }

        function CreateExamRecord(obj){
            return $http.post('/api/v1/exam_records', obj).then(handleSuccess, handleError2);
        }

        function GetStudentTrainingRecordsForFlight(user_id, course_id, flight_id){
            return $http.get('/api/v1/training_records/student/'+course_id+'/'+user_id+'/'+flight_id).then(handleSuccess, handleError2);
        }


        // LESSON CONTENT FILES
        function GetLessonContentFiles(lesson_id) {
            return $http.get('/api/v1/lesson_content_files/lesson/' + lesson_id).then(handleSuccess, handleError2);
        }

        function GetLessonContentFileData(file_id) {
            return $http.get('/api/v1/lesson_content_files/file/' + file_id).then(handleSuccess, handleError2);
        }

        function UploadLessonContentFile(formData) {
            return $http.post('/api/v1/lesson_content_files', formData, {
                transformRequest: angular.identity,
                headers: { 'Content-Type': undefined }
            }).then(handleSuccess, handleError2);
        }

        function UpdateLessonContentFile(id, formData) {
            return $http.post('/api/v1/lesson_content_files/' + id, formData, {
                transformRequest: angular.identity,
                headers: { 'Content-Type': undefined }
            }).then(handleSuccess, handleError2);
        }

        function DeleteLessonContentFile(id) {
            return $http.delete('/api/v1/lesson_content_files/' + id).then(handleSuccess, handleError2);
        }

        function UpdateLessonContentFilesOrder(orderData) {
            return $http.post('/api/v1/lesson_content_files/organise', orderData).then(handleSuccess, handleError2);
        }


        function handleError2(res) {
            console.log("ERROR", res);

            if(res.status == 401){
                $location.path('/login');
            }    

            return { success: false, message: res.data, status: res.status };
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