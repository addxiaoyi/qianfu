package cn.exrick.common.utils;

import cn.exrick.bean.dto.PageVo;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

public class PageUtil {

    public static Pageable initPage(PageVo page){

        int pageNumber = page.getPageNumber();
        int pageSize = page.getPageSize();
        String sort = page.getSort();
        String order = page.getOrder();

        if(pageNumber < 1){
            pageNumber = 1;
        }
        if(pageSize < 1){
            pageSize = 10;
        }

        if(StringUtils.isNotBlank(sort)) {
            Sort.Direction d;
            if(StringUtils.isBlank(order)) {
                d = Sort.Direction.DESC;
            } else {
                d = Sort.Direction.valueOf(order.toUpperCase());
            }
            Sort s = Sort.by(d, sort);
            return PageRequest.of(pageNumber - 1, pageSize, s);
        } else {
            return PageRequest.of(pageNumber - 1, pageSize);
        }
    }
}
