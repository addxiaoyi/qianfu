package cn.exrick.dao;

import cn.exrick.bean.XpayTenantPaymentMethod;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface XpayTenantPaymentMethodDao extends JpaRepository<XpayTenantPaymentMethod, Long> {

    List<XpayTenantPaymentMethod> findByTenantIdOrderByIdAsc(Long tenantId);

    Optional<XpayTenantPaymentMethod> findByTenantIdAndPayType(Long tenantId, String payType);
}
