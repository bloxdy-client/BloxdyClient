#pragma once
#include <glm/gtc/matrix_transform.hpp>
#include <glm/gtc/type_ptr.hpp>
#include <cmath>
#include <cstdint>
#include <stdexcept>

namespace bridge {
struct CameraFrame {
    glm::mat4 view{1},projection{1},viewInverse{1},projectionInverse{1};
    glm::mat4 previousView{1},previousProjection{1},eyeRelativeView{1};
    glm::dvec3 origin{0},absoluteCamera{0};glm::vec3 camera{0},previousCamera{0};
    bool absoluteKnown=false,historyValid=false;int width=0,height=0;
    double seconds=0;float delta=0;uint64_t counter=0;
};
class CameraHistory {
    CameraFrame completed;bool valid=false;uint64_t counter=0;
public:
    void reset(){valid=false;}
    static glm::mat4 checkedInverse(const glm::mat4& matrix){
        const float determinant=glm::determinant(matrix);
        if(!std::isfinite(determinant)||std::abs(determinant)<1e-12f)throw std::runtime_error("Singular camera matrix.");
        const auto inverse=glm::inverse(matrix);for(int i=0;i<16;++i)if(!std::isfinite(glm::value_ptr(inverse)[i]))throw std::runtime_error("Invalid camera inverse.");return inverse;
    }
    CameraFrame prepare(const glm::mat4& view,const glm::mat4& projection,const glm::vec3& camera,const glm::dvec3& origin,bool known,bool halfZ,int width,int height,double seconds)const{
        if(width<1||height<1||!std::isfinite(seconds)||seconds<0)throw std::runtime_error("Invalid camera frame dimensions/time.");
        CameraFrame next;next.view=view;next.projection=projection;next.camera=camera;next.origin=origin;next.absoluteKnown=known;next.absoluteCamera=origin+glm::dvec3(camera);
        // WebGL half-Z is converted once, including the inverse and history.
        if(halfZ)for(int c=0;c<4;++c)next.projection[c][2]=2*projection[c][2]-projection[c][3];
        next.viewInverse=checkedInverse(view);next.projectionInverse=checkedInverse(next.projection);
        next.eyeRelativeView=view*glm::translate(glm::mat4(1),camera);next.width=width;next.height=height;next.seconds=seconds;next.counter=counter;
        next.historyValid=valid&&completed.width==width&&completed.height==height&&completed.absoluteKnown==known&&seconds>=completed.seconds;
        if(next.historyValid){
            const auto shift=glm::vec3(origin-completed.origin);
            next.previousView=completed.view*glm::translate(glm::mat4(1),shift);next.previousProjection=completed.projection;
            next.previousCamera=glm::vec3(completed.absoluteCamera-origin);next.delta=static_cast<float>(seconds-completed.seconds);
        }else {next.previousView=next.view;next.previousProjection=next.projection;next.previousCamera=camera;}
        return next;
    }
    void commit(const CameraFrame& frame){completed=frame;valid=true;++counter;}
};
}
