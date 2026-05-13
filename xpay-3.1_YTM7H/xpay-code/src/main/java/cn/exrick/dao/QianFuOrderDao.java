package cn.exrick.dao;

import cn.exrick.bean.QianFuOrder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Date;
import java.util.List;
import java.util.Optional;

@Repository
public interface QianFuOrderDao extends JpaRepository<QianFuOrder, Long> {

    Optional<QianFuOrder> findByOrderId(String orderId);

    Optional<QianFuOrder> findByQianfuOrderId(String qianfuOrderId);

    List<QianFuOrder> findByStatus(Integer status);

    List<QianFuOrder> findByCreateTimeBetween(Date startTime, Date endTime);

    @Modifying
    @Query("UPDATE QianFuOrder q SET q.status = :status, q.updateTime = :updateTime WHERE q.orderId = :orderId")
    int updateStatus(@Param("orderId") String orderId, @Param("status") Integer status, @Param("updateTime") Date updateTime);

    @Modifying
    @Query("UPDATE QianFuOrder q SET q.status = 1, q.payTime = :payTime, q.updateTime = :updateTime WHERE q.orderId = :orderId")
    int updatePaySuccess(@Param("orderId") String orderId, @Param("payTime") Date payTime, @Param("updateTime") Date updateTime);

    @Modifying
    @Query("UPDATE QianFuOrder q SET q.notifyCount = q.notifyCount + 1 WHERE q.orderId = :orderId")
    int incrementNotifyCount(@Param("orderId") String orderId);

    long countByStatus(Integer status);
}